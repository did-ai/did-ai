#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

cd "$PROJECT_ROOT"

echo "========================================"
echo "  did:ai - Start & Test"
echo "========================================"
echo ""
echo "Usage:"
echo "  ./start.sh         # Start containers + run all tests"
echo "  ./start.sh up       # Start containers only"
echo "  ./start.sh test     # Run API tests only"
echo "  ./start.sh unit     # Run unit tests"
echo "  ./start.sh down     # Stop containers"
echo "  ./start.sh clean    # Clean up everything"
echo ""

COMMAND="${1:-full}"

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed"
        exit 1
    fi
    if ! docker compose version &> /dev/null; then
        echo "Error: Docker Compose is not installed"
        exit 1
    fi
}

start_services() {
    echo "Starting Docker services..."
    docker compose up -d
    echo "Waiting for services to be ready..."
    sleep 5
    
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo "Services ready!"
            return 0
        fi
        echo "Waiting... ($i/30)"
        sleep 2
    done
    
    echo "Failed to start services"
    docker compose logs
    exit 1
}

stop_services() {
    echo "Stopping Docker services..."
    docker compose down
    echo "Services stopped"
}

run_unit_tests() {
    echo "Running unit tests..."
    bun test
}

run_api_tests() {
    echo "Running API tests..."
    ./scripts/test-api-full.sh
}

check_docker

case "$COMMAND" in
    up)
        start_services
        ;;
    down)
        stop_services
        ;;
    restart)
        stop_services
        start_services
        ;;
    test)
        run_api_tests
        ;;
    unit)
        run_unit_tests
        ;;
    full)
        start_services
        run_unit_tests
        run_api_tests
        echo ""
        echo "========================================"
        echo "  All Tests Passed!"
        echo "========================================"
        ;;
    clean)
        echo "Cleaning up..."
        docker compose down -v
        rm -rf .env
        echo "Cleanup complete"
        ;;
    *)
        echo "Unknown command: $COMMAND"
        exit 1
        ;;
esac