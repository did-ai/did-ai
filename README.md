# did:ai

Decentralized identity system for AI agents, skills, and workflows.

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker and Docker Compose
- Bun (for development)

### Installation

```bash
# Install dependencies
bun install

# Start infrastructure
docker-compose up -d

# Run migrations
bun run db:migrate

# Start development server
bun run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

## Development

```bash
# Run tests
bun test

# Lint code
bun run lint

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
docker-compose down
```

## Testing

### Full Docker Test Suite

Run the complete test suite with Docker:

```bash
# Start services, run unit tests, run API tests
./scripts/docker-test.sh full

# Start services only
./scripts/docker-test.sh up

# Run API tests only
./scripts/docker-test.sh test

# Stop services
./scripts/docker-test.sh down

# View logs
./scripts/docker-test.sh logs

# Clean up (remove containers and volumes)
./scripts/docker-test.sh clean
```

### Unit Tests

```bash
# Run all unit tests
bun test

# Run specific test file
bun test src/crypto/crypto.test.ts

# Run with verbose output
bun test --reporter=verbose
```

### API Tests

```bash
# Ensure services are running first
./scripts/start-dev.sh

# Run API interface tests
./scripts/test-api.sh

# Run full API tests with more endpoints
./scripts/test-api-full.sh
```

### Development Setup + Tests

```bash
# Complete setup: start services + run tests
./scripts/setup-and-test.sh
```

## API Endpoints

### Public Endpoints

| Method | Endpoint                      | Description          |
| ------ | ----------------------------- | -------------------- |
| GET    | `/health`                     | Health check         |
| GET    | `/api/v1/platform/public-key` | Platform public keys |
| GET    | `/api/v1/dids/:did`           | Resolve DID          |
| GET    | `/api/v1/discover/skills`     | Search skills        |
| GET    | `/api/v1/discover/agents`     | Search agents        |

### Authenticated Endpoints

| Method | Endpoint                             | Description           |
| ------ | ------------------------------------ | --------------------- |
| POST   | `/api/v1/dids`                       | Create DID            |
| PATCH  | `/api/v1/dids/:did`                  | Update DID            |
| DELETE | `/api/v1/dids/:did`                  | Deactivate DID        |
| POST   | `/api/v1/skills`                     | Create skill family   |
| POST   | `/api/v1/skills/:familyDid/versions` | Publish skill version |
| POST   | `/api/v1/agents`                     | Create agent family   |
| POST   | `/api/v1/agents/:familyDid/versions` | Publish agent version |
