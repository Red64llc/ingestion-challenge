#!/bin/bash

API_BASE="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com"
API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"

echo "=== Testing High-Throughput Stream Feed ==="
echo ""

# Step 1: Get stream access with dashboard cookie
echo "--- Step 1: Get stream access ---"
STREAM_RESPONSE=$(curl -s -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Cookie: dashboard_api_key=$API_KEY")

echo "$STREAM_RESPONSE" | jq '.'
echo ""

# Extract token and endpoint
ENDPOINT=$(echo "$STREAM_RESPONSE" | jq -r '.streamAccess.endpoint')
TOKEN=$(echo "$STREAM_RESPONSE" | jq -r '.streamAccess.token')
EXPIRES_IN=$(echo "$STREAM_RESPONSE" | jq -r '.streamAccess.expiresIn')

echo "Endpoint: $ENDPOINT"
echo "Token: ${TOKEN:0:20}..."
echo "Expires in: $EXPIRES_IN seconds"
echo ""

if [ "$ENDPOINT" = "null" ] || [ -z "$ENDPOINT" ]; then
  echo "ERROR: Failed to get stream access"
  exit 1
fi

# Step 2: Test the feed endpoint
echo "--- Step 2: Test feed endpoint ---"
FEED_URL="$API_BASE$ENDPOINT"
echo "Feed URL: $FEED_URL"
echo ""

# First request without cursor
echo "--- First feed request (no cursor, limit=5000) ---"
FEED_RESPONSE=$(curl -s "$FEED_URL?limit=5000" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Stream-Token: $TOKEN")

echo "$FEED_RESPONSE" | jq '{pagination: .pagination, meta: .meta}'
echo ""

# Check rate limits
echo "--- Rate limit test: 5 rapid requests ---"
for i in {1..5}; do
  start=$(date +%s.%N)
  response=$(curl -s -w "|%{http_code}" "$FEED_URL?limit=5000" \
    -H "X-API-Key: $API_KEY" \
    -H "X-Stream-Token: $TOKEN")
  end=$(date +%s.%N)
  elapsed=$(echo "$end - $start" | bc)

  status=$(echo "$response" | rev | cut -d'|' -f1 | rev)
  body=$(echo "$response" | sed 's/|[0-9]*$//')
  returned=$(echo "$body" | jq -r '.meta.returned // "error"')

  echo "Request $i: status=$status, events=$returned, time=${elapsed}s"

  if [ "$status" = "429" ]; then
    echo "Rate limited!"
    echo "$body" | jq '.rateLimit'
    break
  fi
done
echo ""

# Performance test
echo "--- Performance test: fetch 50,000 events ---"
CURSOR=""
TOTAL=0
START=$(date +%s.%N)

for i in {1..10}; do
  if [ -z "$CURSOR" ]; then
    URL="$FEED_URL?limit=5000"
  else
    URL="$FEED_URL?limit=5000&cursor=$CURSOR"
  fi

  response=$(curl -s "$URL" \
    -H "X-API-Key: $API_KEY" \
    -H "X-Stream-Token: $TOKEN")

  returned=$(echo "$response" | jq -r '.meta.returned')
  CURSOR=$(echo "$response" | jq -r '.pagination.nextCursor')
  hasMore=$(echo "$response" | jq -r '.pagination.hasMore')

  TOTAL=$((TOTAL + returned))
  echo "Batch $i: +$returned events (total: $TOTAL)"

  if [ "$hasMore" = "false" ]; then
    echo "No more data"
    break
  fi
done

END=$(date +%s.%N)
ELAPSED=$(echo "$END - $START" | bc)
RATE=$(echo "$TOTAL / $ELAPSED" | bc)

echo ""
echo "=== Results ==="
echo "Fetched: $TOTAL events"
echo "Time: ${ELAPSED}s"
echo "Rate: $RATE events/sec"
echo ""
echo "Projected time for 3M events: $(echo "3000000 / $RATE" | bc) seconds"
