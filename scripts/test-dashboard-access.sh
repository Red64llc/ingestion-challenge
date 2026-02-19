#!/bin/bash

API_BASE="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com"
API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"

echo "=== Testing Dashboard Access Methods ==="
echo ""

# Try with Referer header (pretending to come from dashboard)
echo "--- With Referer header ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Referer: $API_BASE/" \
  -H "Origin: $API_BASE" | head -20
echo ""

# Try with apiKey in query string (like the dashboard URL)
echo "--- With apiKey query param ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access?api_key=$API_KEY" \
  -H "Content-Type: application/json" | head -20
echo ""

# Try with cookie
echo "--- With cookie ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Cookie: api_key=$API_KEY" | head -20
echo ""

# Try GET instead of POST
echo "--- GET method ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" | head -20
echo ""

# Try with X-Dashboard header
echo "--- With X-Dashboard header ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Dashboard: true" \
  -H "Content-Type: application/json" | head -20
echo ""

# Try with request body containing apiKey
echo "--- With apiKey in body ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"$API_KEY\"}" | head -20
echo ""

# Check if there's a session/login endpoint
echo "--- Check /internal/login or /auth ---"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/internal/login" | head -10
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/auth" | head -10
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE/api/v1/auth" | head -10
echo ""

# Try the dashboard page and extract any session tokens
echo "--- Fetch dashboard and look for session/tokens ---"
DASHBOARD=$(curl -s "$API_BASE/?api_key=$API_KEY" -c /tmp/cookies.txt -b /tmp/cookies.txt)
echo "Cookies:"
cat /tmp/cookies.txt 2>/dev/null || echo "No cookies"
echo ""

# Try stream-access with cookies from dashboard
echo "--- Stream access with dashboard cookies ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Referer: $API_BASE/?api_key=$API_KEY" \
  -b /tmp/cookies.txt | head -20
echo ""

# Check what headers the dashboard JS sends
echo "--- Try Accept: text/event-stream ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" | head -20
