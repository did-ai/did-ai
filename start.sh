#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

cd "$PROJECT_ROOT"

echo "========================================"
echo "  did:ai - Development Startup Script"
echo "========================================"
echo ""

show_help() {
    echo "Usage: ./start.sh [command]"
    echo ""
    echo "Commands:"
    echo "  all         Run everything (default)"
    echo "  docker      Start Docker containers only"
    echo "  stop        Stop Docker containers"
    echo "  down        Stop and remove Docker containers"
    echo "  test        Run unit tests"
    echo "  api-test    Run API integration tests"
    echo "  build       Build the project"
    echo "  lint        Run linting"
    echo "  clean       Clean build artifacts"
    echo ""
}

start_docker() {
    echo "Starting Docker containers..."
    docker-compose up -d
    
    echo ""
    echo "Waiting for services to be healthy..."
    
    echo -n "  PostgreSQL"
    until docker-compose exec -T postgres pg_isready -U didai -d didai &>/dev/null; do
        echo -n "."
        sleep 2
    done
    echo " ✓"
    
    echo -n "  Redis"
    until docker-compose exec -T redis redis-cli ping &>/dev/null; do
        echo -n "."
        sleep 2
    done
    echo " ✓"
    
    echo -n "  API"
    until curl -sf http://localhost:3000/health &>/dev/null; do
        echo -n "."
        sleep 2
    done
    echo " ✓"
    
    echo ""
    echo "All services are ready!"
}

stop_docker() {
    echo "Stopping Docker containers..."
    docker-compose stop
    echo "Containers stopped."
}

down_docker() {
    echo "Stopping and removing Docker containers..."
    docker-compose down
    echo "Containers removed."
}

run_tests() {
    echo ""
    echo "========================================"
    echo "  Running Unit Tests"
    echo "========================================"
    echo ""
    bun test
}

run_api_tests() {
    echo ""
    echo "========================================"
    echo "  Running API Integration Tests"
    echo "========================================"
    echo ""
    
    if ! curl -sf http://localhost:3000/health &>/dev/null; then
        echo "Error: API is not running. Start it with: ./start.sh docker"
        exit 1
    fi
    
    bash "$PROJECT_ROOT/scripts/test-api-full.sh"
}

build_project() {
    echo ""
    echo "========================================"
    echo "  Building Project"
    echo "========================================"
    echo ""
    bun run build
}

run_lint() {
    echo ""
    echo "========================================"
    echo "  Running Linter"
    echo "========================================"
    echo ""
    bun run lint 2>/dev/null || echo "No lint command configured."
}

clean_project() {
    echo ""
    echo "Cleaning build artifacts..."
    rm -rf dist
    rm -rf .turbo
    echo "Clean complete."
}

COMMAND="${1:-all}"

case "$COMMAND" in
    all)
        start_docker
        build_project
        run_tests
        run_api_tests
        echo ""
        echo "========================================"
        echo "  All Steps Completed Successfully!"
        echo "========================================"
        ;;
    docker)
        start_docker
        ;;
    stop)
        stop_docker
        ;;
    down)
        down_docker
        ;;
    test)
        run_tests
        ;;
    api-test)
        run_api_tests
        ;;
    build)
        build_project
        ;;
    lint)
        run_lint
        ;;
    clean)
        clean_project
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac
