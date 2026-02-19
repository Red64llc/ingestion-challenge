#!/bin/bash

API_BASE="${API_BASE_URL:-http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1}"

if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY required"
  exit 1
fi

echo "=== Checking Sessions for faster ingestion ==="

# Get a session ID first
echo "Getting sample session..."
SESSION=$(curl -s "$API_BASE/sessions?limit=1" -H "X-API-Key: $API_KEY" | jq -r '.data[0].id')
echo "Session ID: $SESSION"
echo ""

# Check session-specific endpoints
echo "--- Session events endpoint ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/sessions/$SESSION/events" -H "X-API-Key: $API_KEY" | head -30
echo ""

echo "--- Session events with limit ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/sessions/$SESSION/events?limit=1000" -H "X-API-Key: $API_KEY" | head -30
echo ""

# Check rate limits on sessions endpoint
echo "--- Sessions rate limit test (burst 15 requests) ---"
for i in {1..15}; do
  response=$(curl -s -w "HTTP:%{http_code}" "$API_BASE/sessions?limit=100" -H "X-API-Key: $API_KEY")
  status=$(echo "$response" | grep -o 'HTTP:[0-9]*' | cut -d: -f2)
  if [ "$status" = "429" ]; then
    echo "Request $i: RATE LIMITED"
    echo "$response" | sed 's/HTTP:.*//' | jq -r '.rateLimit' 2>/dev/null
    break
  else
    echo "Request $i: OK (status $status)"
  fi
done
echo ""

# Check for events by user endpoint
echo "--- User events endpoint ---"
USER_ID=$(curl -s "$API_BASE/sessions?limit=1" -H "X-API-Key: $API_KEY" | jq -r '.data[0].userId')
echo "User ID: $USER_ID"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/users/$USER_ID/events" -H "X-API-Key: $API_KEY" | head -20
echo ""

# Check for stream/websocket endpoints
echo "--- Alternative fast endpoints ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/events/all" -H "X-API-Key: $API_KEY" | head -10
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/events/dump" -H "X-API-Key: $API_KEY" | head -10
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/events/batch" -H "X-API-Key: $API_KEY" | head -10
curl -s -w "\nStatus: %{http_code}\n" -H "Accept: application/x-ndjson" "$API_BASE/events?limit=5000" -H "X-API-Key: $API_KEY" | head -10
echo ""

# Check if different Accept headers change behavior
echo "--- Testing Accept headers ---"
echo "Accept: text/event-stream"
curl -s -w "\nStatus: %{http_code}\n" -H "Accept: text/event-stream" "$API_BASE/events" -H "X-API-Key: $API_KEY" | head -10
echo ""

echo "Accept: application/octet-stream"
curl -s -w "\nStatus: %{http_code}\n" -H "Accept: application/octet-stream" "$API_BASE/events" -H "X-API-Key: $API_KEY" | head -10
echo ""

# Check if connection reuse helps (HTTP/2, keep-alive)
echo "--- Connection info ---"
curl -sI "$API_BASE/events?limit=1" -H "X-API-Key: $API_KEY" | grep -i -E "connection|http|keep-alive|alt-svc"
