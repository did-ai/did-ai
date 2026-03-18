#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

cd "$PROJECT_ROOT"

echo "========================================"
echo "  did:ai - Docker Full Test Suite"
echo "========================================"
echo ""

show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  up         - Start all Docker services"
    echo "  down       - Stop all Docker services"
    echo "  restart    - Restart all Docker services"
    echo "  test       - Run API tests"
    echo "  full       - Up + Test (default)"
    echo "  logs       - Show Docker logs"
    echo "  clean      - Remove containers and volumes"
    echo ""
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed"
        exit 1
    fi
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo "Error: Docker Compose is not installed"
        exit 1
    fi
}

start_services() {
    echo "Starting Docker services..."
    docker compose up -d
    echo "Waiting for services to be healthy..."
    sleep 5
    
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo "Services are ready!"
            return 0
        fi
        echo "Waiting for services... ($i/30)"
        sleep 2
    done
    
    echo "Services failed to start"
    docker compose logs
    exit 1
}

stop_services() {
    echo "Stopping Docker services..."
    docker compose down
    echo "Services stopped"
}

run_tests() {
    echo ""
    echo "Running API tests..."
    echo ""
    $PROJECT_ROOT/scripts/test-api-full.sh
}

run_unit_tests() {
    echo ""
    echo "Running unit tests..."
    echo ""
    bun test
}

COMMAND="${1:-full}"

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
        run_tests
        ;;
    full)
        start_services
        run_unit_tests
        run_tests
        echo ""
        echo "========================================"
        echo "  All Tests Complete!"
        echo "========================================"
        ;;
    logs)
        docker compose logs -f
        ;;
    clean)
        echo "Cleaning up Docker resources..."
        docker compose down -v
        rm -rf .env
        echo "Cleanup complete"
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac
