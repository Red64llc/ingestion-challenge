#!/bin/bash

API_BASE="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com"
API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"

echo "=== More Stream Access Attempts ==="
echo ""

# Try with browser User-Agent
echo "--- With Chrome User-Agent ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -H "Accept: application/json" \
  -H "Origin: $API_BASE" \
  -H "Referer: $API_BASE/?api_key=$API_KEY" | head -20
echo ""

# Try with X-Requested-With (AJAX indicator)
echo "--- With X-Requested-With: XMLHttpRequest ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" | head -20
echo ""

# Try with Sec-Fetch headers (browser fetch metadata)
echo "--- With Sec-Fetch headers ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Sec-Fetch-Dest: empty" \
  -H "Sec-Fetch-Mode: cors" \
  -H "Sec-Fetch-Site: same-origin" | head -20
echo ""

# Try different internal endpoints
echo "--- Try /internal/stream ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/internal/stream" -H "X-API-Key: $API_KEY" | head -20
echo ""

echo "--- Try /internal/events/stream ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/internal/events/stream" -H "X-API-Key: $API_KEY" | head -20
echo ""

echo "--- Try /api/v1/stream ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/api/v1/stream" -H "X-API-Key: $API_KEY" | head -20
echo ""

echo "--- Try /api/v1/events/stream ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/api/v1/events/stream" -H "X-API-Key: $API_KEY" | head -20
echo ""

# Try with empty body vs no body
echo "--- POST with empty JSON body ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' | head -20
echo ""

# Try with mode in body
echo "--- POST with mode: stream ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode": "stream"}' | head -20
echo ""

# Try different content types
echo "--- With Content-Type: text/plain ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: text/plain" | head -20
echo ""

# Check if there's an upgrade to WebSocket
echo "--- WebSocket upgrade attempt ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" | head -20
echo ""

# Try SSE endpoint directly
echo "--- SSE on /events endpoint ---"
curl -s -N --max-time 3 "$API_BASE/api/v1/events" \
  -H "X-API-Key: $API_KEY" \
  -H "Accept: text/event-stream" | head -20
echo "(3s timeout)"
echo ""

# Check all /internal endpoints
echo "--- List internal endpoints ---"
for endpoint in stream events bulk download export fast batch all dump; do
  result=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/internal/$endpoint" -H "X-API-Key: $API_KEY")
  echo "/internal/$endpoint: $result"
done
echo ""

# Try with dashboard path prefix
echo "--- Dashboard prefixed endpoints ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" | head -10
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/dashboard/stream" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" | head -10
