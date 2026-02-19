#!/bin/bash

API_BASE="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1"
API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"

echo "=== Testing /events/bulk endpoint ==="
echo ""

# GET request
echo "--- GET /events/bulk ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/events/bulk" -H "X-API-Key: $API_KEY" | head -50
echo ""

# GET with limit
echo "--- GET /events/bulk?limit=10000 ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/events/bulk?limit=10000" -H "X-API-Key: $API_KEY" | head -50
echo ""

# POST request (maybe it initiates a bulk export job?)
echo "--- POST /events/bulk ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/events/bulk" -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" | head -50
echo ""

# POST with body
echo "--- POST /events/bulk with body ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/events/bulk" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100000}' | head -50
echo ""

# Check response headers
echo "--- Headers for /events/bulk ---"
curl -sI "$API_BASE/events/bulk" -H "X-API-Key: $API_KEY"
echo ""

# Try different Accept headers
echo "--- GET /events/bulk with Accept: application/x-ndjson ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/events/bulk" \
  -H "X-API-Key: $API_KEY" \
  -H "Accept: application/x-ndjson" | head -20
echo ""

echo "--- GET /events/bulk with Accept: text/csv ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/events/bulk" \
  -H "X-API-Key: $API_KEY" \
  -H "Accept: text/csv" | head -20
echo ""

# Maybe it needs streaming?
echo "--- GET /events/bulk streaming (5s timeout) ---"
timeout 5 curl -sN "$API_BASE/events/bulk" -H "X-API-Key: $API_KEY" | head -100
echo ""
echo "(timeout after 5s)"

# Check OPTIONS
echo "--- OPTIONS /events/bulk ---"
curl -s -X OPTIONS "$API_BASE/events/bulk" -H "X-API-Key: $API_KEY" -i | head -20
