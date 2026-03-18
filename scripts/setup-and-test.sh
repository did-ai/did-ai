#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

cd "$PROJECT_ROOT"

echo "========================================"
echo "  did:ai - Full Development Setup"
echo "========================================"
echo ""

$PROJECT_ROOT/scripts/start-dev.sh

echo ""
echo "Running API tests..."
echo ""

$PROJECT_ROOT/scripts/test-api.sh

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
