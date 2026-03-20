#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

API_URL="${API_URL:-http://localhost:3000}"
FAILED=0
PASSED=0

echo "========================================"
echo "  did:ai - Complete API Interface Tests"
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
    local auth_header="$6"
    
    echo -n "Testing $name... "
    
    if [ -n "$data" ]; then
        if [ -n "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Content-Type: application/json" \
                -H "Authorization: $auth_header" \
                -d "$data" \
                "$API_URL$endpoint" 2>/dev/null || echo "000")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$API_URL$endpoint" 2>/dev/null || echo "000")
        fi
    else
        if [ -n "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                -H "Authorization: $auth_header" \
                "$API_URL$endpoint" 2>/dev/null || echo "000")
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" \
                "$API_URL$endpoint" 2>/dev/null || echo "000")
        fi
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo "✓ PASS (HTTP $status_code)"
        PASSED=$((PASSED + 1))
    else
        echo "✗ FAIL (Expected $expected_status, got $status_code)"
        echo "  Response: ${body:0:200}"
        FAILED=$((FAILED + 1))
    fi
}

echo "----------------------------------------"
echo "  Health Check Tests"
echo "----------------------------------------"

test_endpoint "Health Check" "GET" "/health"
test_endpoint "Platform Public Keys" "GET" "/api/v1/platform/public-key"

echo ""
echo "----------------------------------------"
echo "  DID Resolution Tests (Public)"
echo "----------------------------------------"

test_endpoint "Resolve non-existent DID" "GET" "/api/v1/dids/did:ai:dev:hub:nonexistent" "404"

echo ""
echo "----------------------------------------"
echo "  Skill Discovery Tests (Public)"
echo "----------------------------------------"

test_endpoint "Search Skills (empty query)" "GET" "/api/v1/discover/skills"
test_endpoint "Search Skills (with query)" "GET" "/api/v1/discover/skills?q=example" "200"
test_endpoint "Search Agents (empty query)" "GET" "/api/v1/discover/agents"
test_endpoint "Search Agents (with query)" "GET" "/api/v1/discover/agents?q=example" "200"

echo ""
echo "----------------------------------------"
echo "  DID Resolution with Version Query Tests"
echo "----------------------------------------"

test_endpoint "Resolve DID with version query (non-existent version)" "GET" "/api/v1/dids/did:ai:skill:hub:test?version=1.0.0" "404"
test_endpoint "Resolve DID with service query" "GET" "/api/v1/dids/did:ai:dev:hub:test?service=test" "404"
test_endpoint "Resolve DID with fragment" "GET" "/api/v1/dids/did:ai:dev:hub:test#signing-key" "404"

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
