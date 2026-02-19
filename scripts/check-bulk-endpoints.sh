#!/bin/bash

# Check for bulk export endpoints in the DataSync API

API_BASE="${API_BASE_URL:-http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1}"

if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY environment variable is required"
  echo "Usage: API_KEY=your-key ./scripts/check-bulk-endpoints.sh"
  exit 1
fi

echo "=== Checking API: $API_BASE ==="
echo ""

# Helper function
check_endpoint() {
  local endpoint=$1
  local description=$2
  echo "--- $description ---"
  echo "GET $endpoint"
  response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE$endpoint" -H "X-API-Key: $API_KEY")
  status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
  body=$(echo "$response" | sed '/HTTP_STATUS/d')
  echo "Status: $status"
  if [ "$status" != "404" ] && [ "$status" != "401" ]; then
    echo "$body" | head -c 500
    echo ""
  fi
  echo ""
}

# 1. Check root for available endpoints
check_endpoint "" "Root endpoint (may list available routes)"

# 2. Check for OpenAPI/Swagger docs
check_endpoint "/docs" "OpenAPI docs"
check_endpoint "/openapi.json" "OpenAPI JSON spec"
check_endpoint "/swagger.json" "Swagger JSON spec"

# 3. Check for bulk/export endpoints
check_endpoint "/events/bulk" "Bulk events endpoint"
check_endpoint "/events/export" "Export events endpoint"
check_endpoint "/bulk" "Bulk endpoint"
check_endpoint "/export" "Export endpoint"
check_endpoint "/events/stream" "Stream endpoint"

# 4. Test pagination parameters
echo "--- Testing pagination parameters ---"
echo ""

echo "Current default (limit=100):"
curl -s "$API_BASE/events?limit=100" -H "X-API-Key: $API_KEY" | jq -r '.pagination // .error // "No pagination info"' 2>/dev/null || echo "jq not available"
echo ""

echo "Larger page size (limit=1000):"
curl -s "$API_BASE/events?limit=1000" -H "X-API-Key: $API_KEY" | jq -r '.pagination // .error // "No pagination info"' 2>/dev/null || echo "jq not available"
echo ""

echo "Very large page size (limit=10000):"
curl -s "$API_BASE/events?limit=10000" -H "X-API-Key: $API_KEY" | jq -r '.pagination // .error // "No pagination info"' 2>/dev/null || echo "jq not available"
echo ""

# 5. Test offset-based pagination
echo "--- Testing offset-based pagination ---"
echo ""

echo "Offset parameter (offset=0):"
curl -s "$API_BASE/events?offset=0&limit=100" -H "X-API-Key: $API_KEY" | jq -r '.pagination // .error // "No pagination info"' 2>/dev/null || echo "jq not available"
echo ""

echo "Page parameter (page=1):"
curl -s "$API_BASE/events?page=1&limit=100" -H "X-API-Key: $API_KEY" | jq -r '.pagination // .error // "No pagination info"' 2>/dev/null || echo "jq not available"
echo ""

echo "Skip parameter (skip=0):"
curl -s "$API_BASE/events?skip=0&limit=100" -H "X-API-Key: $API_KEY" | jq -r '.pagination // .error // "No pagination info"' 2>/dev/null || echo "jq not available"
echo ""

echo "=== Done ==="
