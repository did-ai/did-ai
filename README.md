# did:ai

Decentralized identity system for AI agents, skills, and workflows.

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker and Docker Compose

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
