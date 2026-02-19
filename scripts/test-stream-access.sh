#!/bin/bash

API_BASE="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com"
API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"

echo "=== Testing Stream Access Endpoint ==="
echo ""

# Test internal endpoints
echo "--- GET /internal/health ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/internal/health" | head -20
echo ""

echo "--- GET /internal/stats ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/internal/stats" -H "X-API-Key: $API_KEY" | jq '.' 2>/dev/null | head -30
echo ""

# The key endpoint - stream access!
echo "--- POST /internal/dashboard/stream-access ---"
STREAM_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json")

STATUS=$(echo "$STREAM_RESPONSE" | tail -1)
BODY=$(echo "$STREAM_RESPONSE" | sed '$d')

echo "Status: $STATUS"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# If we got stream access, try to use it
if [ "$STATUS" = "200" ]; then
  echo "=== Stream Access Granted! ==="

  # Extract the stream access details
  STREAM_URL=$(echo "$BODY" | jq -r '.streamAccess.url // .url // empty')
  STREAM_TOKEN=$(echo "$BODY" | jq -r '.streamAccess.token // .token // empty')
  EXPIRES_IN=$(echo "$BODY" | jq -r '.streamAccess.expiresIn // .expiresIn // empty')

  echo "Stream URL: $STREAM_URL"
  echo "Token: ${STREAM_TOKEN:0:20}..."
  echo "Expires in: $EXPIRES_IN seconds"
  echo ""

  # Try to use the stream
  if [ -n "$STREAM_URL" ]; then
    echo "--- Testing stream endpoint ---"
    curl -s -w "\nStatus: %{http_code}\n" "$STREAM_URL" \
      -H "Authorization: Bearer $STREAM_TOKEN" \
      -H "X-API-Key: $API_KEY" | head -50
  fi

  # Also check if there's a different events endpoint with stream token
  echo ""
  echo "--- Testing /api/v1/events with stream token ---"
  curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/api/v1/events?limit=5000" \
    -H "X-API-Key: $API_KEY" \
    -H "X-Stream-Token: $STREAM_TOKEN" | jq '.pagination' 2>/dev/null
fi

echo ""
echo "--- Full stream access response for reference ---"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
