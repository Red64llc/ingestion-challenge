#!/bin/bash

API_BASE="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com"
API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"

echo "=== Attempting to get stream access (browser-like request) ==="
echo ""

# Try with all browser headers
curl -v -X POST "$API_BASE/internal/dashboard/stream-access" \
  -H "Accept: */*" \
  -H "Accept-Encoding: gzip, deflate" \
  -H "Accept-Language: en-US,en;q=0.9" \
  -H "Cache-Control: no-cache" \
  -H "Connection: keep-alive" \
  -H "Content-Type: application/json" \
  -H "Content-Length: 0" \
  -H "Cookie: dashboard_api_key=$API_KEY" \
  -H "Host: datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com" \
  -H "Origin: http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com" \
  -H "Pragma: no-cache" \
  -H "Referer: http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36" \
  -H "X-API-Key: $API_KEY" \
  2>&1

echo ""
