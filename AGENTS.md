# Agent Guidelines for did:ai

## Project Overview

`did:ai` is a decentralized identity system for AI agents, skills, and workflows. Built with TypeScript, Node.js, PostgreSQL, and Redis.

## Build & Test Commands

```bash
# Install dependencies
bun install

# Run database migrations
bun run db:migrate

# Start development server
bun run dev

# Build for production
bun run build

# Run tests
bun test
bun test --filter <pattern>        # Run specific tests
bun test --reporter=verbose        # Verbose output
```

## Project Structure

```
did-ai/
├── src/
│   ├── config/          # Database, Redis, cache TTL configs
│   ├── routes/          # Fastify route handlers
│   ├── services/        # Business logic
│   ├── builders/        # DID document builders
│   ├── crypto/          # Keys, signing, base58 utilities
│   ├── middleware/       # Auth middleware
│   ├── validators/       # Constraint validation
│   └── errors/          # Error codes and classes
├── sdk/                 # Client SDK
├── scripts/             # CLI tools (key generation)
└── docker-compose.yml    # Local infrastructure
```

## Code Style Guidelines

### TypeScript Conventions

- Use strict TypeScript; no `any` types
- Use `interface` for object shapes, `type` for unions/primitives
- Prefer named exports over default exports
- Use `readonly` for immutable data

```typescript
// Good
interface UserProfile {
  readonly id: string;
  name: string;
  email: EmailAddress;
}

// Avoid
const user: any = getUser();
```

### Imports

Order imports by:
1. Node.js built-ins (`node:` prefix)
2. External packages
3. Internal modules (relative paths)
4. Type-only imports use `import type`

```typescript
import { FastifyInstance } from 'fastify';
import bs58 from 'bs58';
import { pool } from '../config/database';
import type { DIDDocument } from '../types';
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables/Functions | camelCase | `generateEd25519KeyPair` |
| Classes/Interfaces | PascalCase | `DidAiError`, `UserProfile` |
| Constants | SCREAMING_SNAKE_CASE | `CACHE_TTL`, `ED25519_PREFIX` |
| TypeScript types | PascalCase | `SkillContent`, `DIDAuthHeader` |
| Files | kebab-case | `did-document.builder.ts` |
| Enums | PascalCase | `ErrorCode` |
| Enum members | SCREAMING_SNAKE_CASE | `ErrorCode.DID_NOT_FOUND` |

### Async/Await

- Always use `async/await` over raw Promises
- Always handle errors with try/catch or `.catch()`
- Use `await` inside `async` functions only

```typescript
// Good
async function createDid(params: CreateParams): Promise<DIDResult> {
  try {
    const did = await pool.query('INSERT...');
    return { did };
  } catch (error) {
    throw new DidAiError(ErrorCode.DID_ALREADY_EXISTS, '...');
  }
}

// Avoid
function createDid(params: CreateParams): Promise<DIDResult> {
  return pool.query('INSERT...').then(did => ({ did }));
}
```

### Error Handling

All errors MUST use `DidAiError` with appropriate `ErrorCode`:

```typescript
import { DidAiError, ErrorCode } from '../errors';

// In services
throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${did}`);

// In middleware
if (!result.rows[0]) {
  throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${did}`);
}
```

Error codes map to HTTP status codes in `ERROR_STATUS`.

### Database Queries

- Use parameterized queries (never string interpolation)
- Use transactions for multi-table operations
- Always release connections back to pool

```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...', [param1, param2]);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### Cryptography

- Use noble/hashes for SHA-256
- Use noble/curves for Ed25519/X25519
- All public keys MUST be encoded as Multibase base58-btc (prefix `z`)
- Signatures MUST be base58-btc encoded

### DID Document Properties

Required properties (Section 4.1 of spec):
- `@context`: `['https://www.w3.org/ns/did/v1', 'https://did-ai.io/contexts/v1']`
- `id`: The DID string
- `controller`: Controller DID
- `created`: ISO 8601 datetime
- `updated`: ISO 8601 datetime
- `service`: Array of service entries (REQUIRED)
- `deactivated`: `true` when deactivated

### Key Separation Invariant

Ed25519 keys for signing:
- `assertionMethod` → Ed25519VerificationKey2020
- `authentication` → Ed25519VerificationKey2020
- `capabilityDelegation` → Ed25519VerificationKey2020 (rotation key only)

X25519 keys for encryption:
- `keyAgreement` → X25519KeyAgreementKey2020

**CRITICAL**: Cross-usage MUST be rejected (Section 4.3 of spec).

### Service Types

| DID Type | Required Service |
|----------|-----------------|
| Developer | `DeveloperProfile`, `PublishedAssets` |
| SkillFamily | `SkillFamily` |
| SkillVersion | `SkillVersion` |
| AgentFamily | `AgentFamily` |
| AgentVersion | `AgentVersion` + `AgentProfile` |

### Comments

- No comments unless explaining WHY (not WHAT)
- Use `//` for single-line, `/* */` for multi-line
- Document complex algorithms or non-obvious decisions


## 关键文件

| 文件 | 用途 |
|------|---------|
| `.opencode/PRD.md` | Understanding requirements, features, API spec |
| `.opencode/spec.md` | did:ai spec |
| `.opencode/implementation.md` | did:ai implementation |


## Testing Guidelines

```typescript
// Use descriptive test names
describe('validateKeySeparation', () => {
  it('should reject Ed25519 key in keyAgreement', async () => {
    // test implementation
  });
});
```

## Security Rules

1. Never log private keys or secrets
2. Never use hardcoded credentials
3. Always validate input against spec constraints
4. Reject DID Documents violating key separation
5. Reject Agent DIDs with network `serviceEndpoint`
6. Use parameterized queries for all database operations
