#!/bin/bash

API_BASE="${API_BASE_URL:-http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1}"

if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY environment variable is required"
  exit 1
fi

echo "=== Extended API Check ==="
echo ""

check() {
  local endpoint=$1
  local desc=$2
  echo "--- $desc ---"
  echo "GET $endpoint"
  response=$(curl -s -w "\nHTTP:%{http_code}" "$API_BASE$endpoint" -H "X-API-Key: $API_KEY" 2>/dev/null)
  status=$(echo "$response" | tail -1 | cut -d: -f2)
  body=$(echo "$response" | sed '$d')
  echo "Status: $status"
  if [ "$status" = "200" ]; then
    echo "$body" | jq -r '.' 2>/dev/null | head -30 || echo "$body" | head -c 500
  elif [ "$status" != "404" ]; then
    echo "$body" | head -c 300
  fi
  echo ""
}

# Known endpoints from root
check "/sessions" "Sessions endpoint"
check "/metrics" "Metrics endpoint"

# Events variations
check "/events/count" "Events count"
check "/events/stats" "Events stats"
check "/events/summary" "Events summary"
check "/events/cursors" "Multiple cursors"
check "/events/partitions" "Partitions"
check "/events/chunks" "Chunks"

# Timestamp-based filtering
echo "--- Timestamp filtering ---"
NOW_MS=$(($(date +%s) * 1000))
HOUR_AGO_MS=$(($NOW_MS - 3600000))
echo "Testing timestamp params..."

curl -s "$API_BASE/events?from=$HOUR_AGO_MS&limit=10" -H "X-API-Key: $API_KEY" | jq -r '.meta // .error // .' 2>/dev/null | head -10
echo ""

curl -s "$API_BASE/events?startTime=$HOUR_AGO_MS&limit=10" -H "X-API-Key: $API_KEY" | jq -r '.meta // .error // .' 2>/dev/null | head -10
echo ""

curl -s "$API_BASE/events?after=$HOUR_AGO_MS&limit=10" -H "X-API-Key: $API_KEY" | jq -r '.meta // .error // .' 2>/dev/null | head -10
echo ""

# ID-based filtering
echo "--- ID-based starting point ---"
curl -s "$API_BASE/events?afterId=00000000-0000-0000-0000-000000000000&limit=10" -H "X-API-Key: $API_KEY" | jq -r '.meta // .error // .' 2>/dev/null | head -10
echo ""

curl -s "$API_BASE/events?startId=00000000-0000-0000-0000-000000000000&limit=10" -H "X-API-Key: $API_KEY" | jq -r '.meta // .error // .' 2>/dev/null | head -10
echo ""

# Batch/parallel hints
check "/events/init" "Init/setup endpoint"
check "/events/prepare" "Prepare endpoint"
check "/jobs" "Jobs endpoint"
check "/tasks" "Tasks endpoint"
check "/downloads" "Downloads endpoint"

# Admin/info endpoints
check "/info" "Info"
check "/status" "Status"
check "/health" "Health"
check "/config" "Config"

# HEAD request to see headers
echo "--- Response headers (HEAD /events) ---"
curl -sI "$API_BASE/events?limit=100" -H "X-API-Key: $API_KEY" | head -20
echo ""

echo "=== Key finding: limit=5000 works! ==="
echo "3M events / 5000 per page = 600 requests (vs 30,000 at limit=100)"
