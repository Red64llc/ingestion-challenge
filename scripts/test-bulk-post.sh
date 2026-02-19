#!/bin/bash

API_BASE="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1"
API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"

echo "=== Testing POST /events/bulk with IDs ==="
echo ""

# First, get some event IDs from regular endpoint
echo "--- Getting sample event IDs ---"
EVENTS=$(curl -s "$API_BASE/events?limit=10" -H "X-API-Key: $API_KEY")
IDS=$(echo "$EVENTS" | jq -r '[.data[].id]')
echo "Sample IDs: $IDS"
echo ""

# Test bulk fetch with those IDs
echo "--- POST /events/bulk with 10 IDs ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/events/bulk" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ids\": $IDS}" | jq '.' 2>/dev/null | head -50
echo ""

# Check rate limit headers after bulk request
echo "--- Rate limit after bulk request ---"
curl -sI -X POST "$API_BASE/events/bulk" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ids\": $IDS}" | grep -i rate
echo ""

# Test with more IDs - fetch 100 events then bulk request them
echo "--- Testing with 100 IDs ---"
EVENTS100=$(curl -s "$API_BASE/events?limit=100" -H "X-API-Key: $API_KEY")
IDS100=$(echo "$EVENTS100" | jq -r '[.data[].id]')

start=$(date +%s.%N)
BULK_RESULT=$(curl -s -X POST "$API_BASE/events/bulk" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ids\": $IDS100}")
end=$(date +%s.%N)
elapsed=$(echo "$end - $start" | bc)

echo "Bulk fetch 100 events took: ${elapsed}s"
echo "Response preview:"
echo "$BULK_RESULT" | jq '{returned: .meta.returned, total: .meta.total}' 2>/dev/null || echo "$BULK_RESULT" | head -20
echo ""

# Test rate limit behavior - can we make many bulk requests?
echo "--- Testing bulk request rate limits (5 requests) ---"
for i in {1..5}; do
  response=$(curl -s -w "|%{http_code}" -X POST "$API_BASE/events/bulk" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"ids\": $IDS}")
  status=$(echo "$response" | rev | cut -d'|' -f1 | rev)
  echo "Request $i: status=$status"
done
echo ""

# The big question: can we generate/predict event IDs?
echo "--- Analyzing event ID patterns ---"
echo "$EVENTS100" | jq -r '.data[].id' | head -20
echo ""
echo "IDs appear to be UUIDs - likely not predictable"
