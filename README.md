# did:ai

Decentralized identity system for AI agents, skills, and workflows. Built with TypeScript, Node.js, PostgreSQL, and Redis.

## Features

- **DID Management** - Create, resolve, update, and deactivate decentralized identifiers
- **DID Auth** - Cryptographic authentication using the DID Auth standard
- **SAID Support** - Self-Addressing Identifiers for immutable references
- **Skill Registry** - Publish and discover AI skill families with versioning
- **Agent Registry** - Create AI agents with skill bindings and orchestration
- **Discovery** - Full-text search for skills and agents

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker and Docker Compose
- Bun (for development)

### Using start.sh

The easiest way to get started:

```bash
# Start all services and run tests
./start.sh

# Start Docker containers only
./start.sh docker

# Run unit tests only
./start.sh test

# Run API integration tests
./start.sh api-test

# Build the project
./start.sh build
```

### Manual Setup

```bash
# Install dependencies
bun install

# Start infrastructure
docker-compose up -d

# Wait for services to be healthy, then run migrations
bun run db:migrate

# Start development server
bun run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required Variables

| Variable            | Description         | Default       |
| ------------------- | ------------------- | ------------- |
| `NODE_ENV`          | Environment         | `development` |
| `PORT`              | API port            | `3000`        |
| `POSTGRES_HOST`     | PostgreSQL host     | `localhost`   |
| `POSTGRES_PORT`     | PostgreSQL port     | `5432`        |
| `POSTGRES_USER`     | PostgreSQL user     | `didai`       |
| `POSTGRES_PASSWORD` | PostgreSQL password | -             |
| `POSTGRES_DB`       | Database name       | `didai`       |
| `REDIS_HOST`        | Redis host          | `localhost`   |
| `REDIS_PORT`        | Redis port          | `6379`        |
| `VDR_NETWORK_ID`    | DID network ID      | `main`        |

## Development

```bash
# Run all tests
bun test

# Run specific test file
bun test src/crypto/crypto.test.ts

# Run with verbose output
bun test --reporter=verbose

# Build for production
bun run build

# Type check
bun run typecheck
```

## Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose stop

# Remove services
docker-compose down

# Clean volumes
docker-compose down -v
```

## DID Format

The did:ai method uses the format:

```
did:ai:{networkId}:{subjectType}:{uniqueId}

Examples:
did:ai:main:dev:Kf8RXsKZXWHLgIOlGH8SAs  (Developer - SAID based)
did:ai:main:skill:vBkyxaGykMwjTLcTQwajm  (Skill Family)
did:ai:main:agent:42JKg0iwDzvPqgbMwNdEpZ  (Agent Family)
```

### Subject Types

| Type    | Description        | Has Keys | Controller    |
| ------- | ------------------ | -------- | ------------- |
| `dev`   | Developer identity | Yes      | Self          |
| `skill` | Skill family       | No       | Developer DID |
| `agent` | Agent family       | No       | Developer DID |

## API Endpoints

### Public Endpoints

| Method | Endpoint                                         | Description              |
| ------ | ------------------------------------------------ | ------------------------ |
| GET    | `/health`                                        | Health check             |
| GET    | `/api/v1/platform/public-key`                    | Get platform public keys |
| GET    | `/api/v1/dids/:did`                              | Resolve DID document     |
| GET    | `/api/v1/skills/:familyDid`                      | Get skill family         |
| GET    | `/api/v1/skills/:familyDid/versions`             | List skill versions      |
| GET    | `/api/v1/skills/:familyDid/versions/:versionDid` | Get skill version        |
| GET    | `/api/v1/skills/:familyDid/content`              | Get active skill content |
| GET    | `/api/v1/skills/:familyDid/changelog/:version`   | Get version changelog    |
| GET    | `/api/v1/agents/:familyDid`                      | Get agent family         |
| GET    | `/api/v1/agents/:familyDid/versions`             | List agent versions      |
| GET    | `/api/v1/agents/:familyDid/versions/:versionDid` | Get agent version        |
| GET    | `/api/v1/discover/skills`                        | Search skills            |
| GET    | `/api/v1/discover/agents`                        | Search agents            |

### Authenticated Endpoints (DID Auth)

| Method | Endpoint                             | Description           |
| ------ | ------------------------------------ | --------------------- |
| POST   | `/api/v1/dids`                       | Create developer DID  |
| PATCH  | `/api/v1/dids/:did`                  | Update DID document   |
| DELETE | `/api/v1/dids/:did`                  | Deactivate DID        |
| POST   | `/api/v1/skills`                     | Create skill family   |
| POST   | `/api/v1/skills/:familyDid/versions` | Publish skill version |
| POST   | `/api/v1/agents`                     | Create agent family   |
| POST   | `/api/v1/agents/:familyDid/versions` | Publish agent version |

### DID Resolution Query Parameters

| Parameter            | Description                      |
| -------------------- | -------------------------------- |
| `?version=X.Y.Z`     | Get specific version info        |
| `?service=serviceId` | Get service endpoint             |
| `#fragment`          | Get specific VM or service entry |

## Client SDK

The `@did-ai/sdk` package provides a TypeScript client for the did:ai API.

### Installation

```bash
npm install @did-ai/sdk
```

### Usage

```typescript
import { DidAiSDK, ErrorCode } from "@did-ai/sdk";

// Create SDK instance
const sdk = new DidAiSDK({
  apiUrl: "https://api.did-ai.io",
  networkId: "main",
  keyProvider: {
    type: "memory",
    sign: async (payload) => {
      // Sign payload with private key
      return signatureBytes;
    },
    getPublicKey: async () => {
      return publicKeyMultibase;
    },
    resolveDid: async (publicKey) => {
      // Resolve DID from public key
      return "did:ai:main:dev:...";
    },
  },
});

// Or use sandbox mode
const sdk = DidAiSDK.sandbox();

// Resolve a DID
const result = await sdk.did.resolve("did:ai:main:dev:...");
console.log(result.didDocument);
console.log(result.didDocumentMetadata);

// Search skills
const skills = await sdk.skills.discover({
  q: "code generation",
  tags: ["ai", "coding"],
  limit: 10,
});

// Create a skill family
const { familyDid } = await sdk.skills.createFamily({
  name: "My Skill",
  description: "A useful skill",
  namespace: "main",
});

// Publish a skill version
await sdk.skills.publishVersion({
  familyDid,
  version: "1.0.0",
  bumpType: "major",
  content: {
    systemPrompt: "You are a helpful assistant.",
    inputSchema: { type: "object" },
    outputSchema: { type: "string" },
  },
  changelog: {
    summary: "Initial release",
    migrationGuide: {
      breakingChanges: "None",
      migrationSteps: "N/A",
    },
  },
});

// Create an agent
const { familyDid: agentDid } = await sdk.agents.createFamily({
  name: "My Agent",
  visibility: "public",
});

// Publish an agent version
await sdk.agents.publishVersion({
  familyDid: agentDid,
  version: "1.0.0",
  bumpType: "major",
  content: {
    name: "My Agent",
    skillBindings: [
      {
        skillFamilyDid: familyDid,
        versionPolicy: "auto_minor",
        role: "primary",
      },
    ],
    orchestrationMode: "standalone",
    visibility: "public",
  },
  changelog: {
    summary: "Initial release",
  },
});
```

### SDK Modules

```typescript
// Platform operations
sdk.platform.getPublicKeys();

// Developer operations
sdk.developers.create({ email, password, displayName });
sdk.developers.update({ did, displayName }, sessionToken);
sdk.developers.resolve(did);

// Skill operations
sdk.skills.createFamily(params);
sdk.skills.getFamily(familyDid);
sdk.skills.listVersions(familyDid);
sdk.skills.getVersion(familyDid, versionDid);
sdk.skills.publishVersion(params);
sdk.skills.getContent(familyDid);
sdk.skills.getChangelog(familyDid, version);
sdk.skills.discover({ q, tags, limit, offset });

// Agent operations
sdk.agents.createFamily(params);
sdk.agents.getFamily(familyDid);
sdk.agents.listVersions(familyDid);
sdk.agents.getVersion(familyDid, versionDid);
sdk.agents.publishVersion(params);
sdk.agents.discover({ q, tags, limit, offset });

// DID operations
sdk.did.resolve(did);
sdk.did.resolveWithVersion(did, version);
sdk.did.resolveWithService(did, serviceId);
sdk.did.resolveFragment(did, fragment);
sdk.did.getVersionHistory(did);
sdk.did.update(did, updates);
sdk.did.deactivate(did);
```

### Error Handling

```typescript
import { DidAiSDK, DidAiError, ErrorCode } from "@did-ai/sdk";

try {
  await sdk.did.resolve("did:ai:main:dev:invalid");
} catch (error) {
  if (error instanceof DidAiError) {
    console.error(error.code); // Error code
    console.error(error.statusCode); // HTTP status code
    console.error(error.retryable); // Can retry?

    if (error.code === ErrorCode.DID_NOT_FOUND) {
      // Handle not found
    }
  }
}
```

## DID Auth

DID Auth is used to authenticate requests using the caller's DID.

### Header Format

```
Authorization: DIDAuth did="{did}", nonce="{nonce}", timestamp="{iso8601}", sig="{signature}"
```

### Payload Format

```json
{
  "did": "did:ai:main:dev:...",
  "networkId": "main",
  "nonce": "unique-id",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "method": "POST",
  "path": "/api/v1/skills",
  "bodyHash": "sha256-hash"
}
```

### Signature

1. Canonicalize the payload
2. Sign with the caller's signing key
3. Encode signature as Multibase Base58BTC with `z` prefix

## Testing

### Full Test Suite

```bash
# Complete setup and tests
./start.sh

# Docker test script
./scripts/docker-test.sh full
```

### Unit Tests

```bash
bun test
bun test --reporter=verbose
bun test --filter <pattern>
```

### API Integration Tests

```bash
# Ensure services are running
./start.sh docker

# Run API tests
./start.sh api-test
# or
./scripts/test-api-full.sh
```

## Project Structure

```
did-ai/
├── src/
│   ├── config/          # Database, Redis, cache TTL configs
│   ├── routes/          # Fastify route handlers
│   ├── services/        # Business logic
│   ├── builders/        # DID document builders
│   ├── crypto/          # Keys, signing, SAID utilities
│   ├── middleware/       # Auth middleware
│   ├── validators/       # Constraint validation
│   └── errors/          # Error codes and classes
├── sdk/                 # Client SDK
├── scripts/             # CLI tools and test scripts
└── docker-compose.yml   # Local infrastructure
```

## Specification

This implementation follows the [did:ai v0.1.0 specification](./.opencode/spec-v0.1.0.md).

Key features:

- W3C DID Core compliant
- Self-Addressing Identifiers (SAID)
- Cryptographic key separation (Ed25519/X25519)
- Network-aware DID resolution

## License

MIT
