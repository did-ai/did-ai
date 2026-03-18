#!/bin/bash

set -e

echo "========================================"
echo "  did:ai - Development Environment"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

cd "$PROJECT_ROOT"

echo ""
echo "[1/4] Checking environment..."
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not installed"
    exit 1
fi

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit .env and set secure passwords for production use"
fi

echo ""
echo "[2/4] Building Docker images..."
docker compose build

echo ""
echo "[3/4] Starting services..."
docker compose up -d

echo ""
echo "[4/4] Waiting for services to be healthy..."
sleep 5

echo ""
echo "Checking service health..."
echo ""

for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U didai -d didai &> /dev/null; then
        echo "✓ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "✗ PostgreSQL failed to start"
        exit 1
    fi
    sleep 2
done

for i in {1..30}; do
    if docker compose exec -T redis redis-cli -u redis://:didai_secret@localhost:6379 ping 2>/dev/null | grep -q PONG; then
        echo "✓ Redis is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "✗ Redis failed to start"
        exit 1
    fi
    sleep 2
done

echo ""
echo "========================================"
echo "  Services started successfully!"
echo "========================================"
echo ""
echo "  API:      http://localhost:3000"
echo "  Health:   http://localhost:3000/health"
echo "  API Docs: http://localhost:3000/docs"
echo ""
echo "  PostgreSQL: localhost:5432"
echo "  Redis:      localhost:6379"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop:      docker compose down"
echo ""
