#!/bin/bash

set -e

echo "========================================"
echo "  did:ai - Stop Services"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

cd "$PROJECT_ROOT"

echo "Stopping services..."
docker compose down

echo ""
echo "✓ Services stopped"
echo ""
echo "To remove data volumes: docker compose down -v"
