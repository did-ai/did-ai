#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

API_URL="${API_URL:-http://localhost:3000}"
FAILED=0
PASSED=0

echo "========================================"
echo "  did:ai - API Interface Tests"
echo "========================================"
echo ""
echo "API URL: $API_URL"
echo ""

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="${4:-200}"
    local data="$5"
    
    echo -n "Testing $name... "
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint" 2>/dev/null || echo "000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "$API_URL$endpoint" 2>/dev/null || echo "000")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo "✓ PASS (HTTP $status_code)"
        ((PASSED++))
    else
        echo "✗ FAIL (Expected $expected_status, got $status_code)"
        echo "  Response: $body"
        ((FAILED++))
    fi
}

echo "----------------------------------------"
echo "  Health Check Tests"
echo "----------------------------------------"

test_endpoint "Health Check" "GET" "/health"

echo ""
echo "----------------------------------------"
echo "  DID Resolution Tests (Public)"
echo "----------------------------------------"

test_endpoint "Resolve non-existent DID" "GET" "/api/v1/dids/did:ai:dev:hub:nonexistent" "404"

echo ""
echo "----------------------------------------"
echo "  Summary"
echo "----------------------------------------"
echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "Some tests failed!"
    exit 1
else
    echo "All tests passed!"
    exit 0
fi
