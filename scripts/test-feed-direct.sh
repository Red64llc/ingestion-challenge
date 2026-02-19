#!/bin/bash

API_BASE="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com"
API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"

# Use the token from the browser (update this from your browser session!)
STREAM_TOKEN="${STREAM_TOKEN:-5ef124930ac586e0e3bc826f2e147b8680c2117133cac092153bcf85d25b9096}"
FEED_ENDPOINT="${FEED_ENDPOINT:-/api/v1/events/d4ta/x7k9/feed}"

echo "=== Testing Feed Endpoint Directly ==="
echo "Token: ${STREAM_TOKEN:0:20}..."
echo "Endpoint: $FEED_ENDPOINT"
echo ""

FEED_URL="$API_BASE$FEED_ENDPOINT"

# Test the feed endpoint
echo "--- Test feed with limit=5000 ---"
response=$(curl -s -w "\n%{http_code}" "$FEED_URL?limit=5000" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Stream-Token: $STREAM_TOKEN")

status=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

echo "Status: $status"
if [ "$status" = "200" ]; then
  echo "$body" | jq '{pagination: .pagination, meta: .meta}'
else
  echo "$body" | head -20
fi
echo ""

if [ "$status" != "200" ]; then
  echo "Feed endpoint failed. Token may have expired."
  echo "Get a new token from the browser's Live Feed tab"
  exit 1
fi

# Performance test - 10 batches
echo "--- Performance test: 10 batches of 5000 ---"
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
    -H "X-Stream-Token: $STREAM_TOKEN")

  returned=$(echo "$response" | jq -r '.meta.returned')
  CURSOR=$(echo "$response" | jq -r '.pagination.nextCursor')
  hasMore=$(echo "$response" | jq -r '.pagination.hasMore')

  TOTAL=$((TOTAL + returned))
  echo "Batch $i: +$returned events (total: $TOTAL)"

  if [ "$hasMore" = "false" ]; then
    break
  fi
done

END=$(date +%s.%N)
ELAPSED=$(echo "$END - $START" | bc)
RATE=$(echo "scale=0; $TOTAL / $ELAPSED" | bc)

echo ""
echo "=== Results ==="
echo "Fetched: $TOTAL events in ${ELAPSED}s"
echo "Rate: $RATE events/sec"
echo "Projected for 3M: $(echo "scale=0; 3000000 / $RATE" | bc) seconds ($(echo "scale=1; 3000000 / $RATE / 60" | bc) min)"
