#!/bin/bash

API_KEY="${API_KEY:-ds_56fb714400de4eb61737736fdb4fd060}"
BASE_URL="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com"

echo "=== Scraping Dashboard ==="
echo ""

# Fetch main page
echo "--- Main page HTML ---"
curl -s "$BASE_URL?api_key=$API_KEY" > /tmp/dashboard.html
cat /tmp/dashboard.html | head -100
echo ""
echo "..."
echo ""

# Look for JavaScript files that might contain API hints
echo "--- Looking for JS files ---"
grep -oE 'src="[^"]+\.js[^"]*"' /tmp/dashboard.html | head -20
echo ""

# Look for API endpoints in HTML
echo "--- API references in HTML ---"
grep -oiE '(api|endpoint|fetch|bulk|fast|stream|export|download|batch)[^<>"]*' /tmp/dashboard.html | sort -u | head -30
echo ""

# Look for data attributes
echo "--- Data attributes ---"
grep -oE 'data-[a-z-]+="[^"]*"' /tmp/dashboard.html | sort -u | head -20
echo ""

# Fetch any linked JS files
echo "--- Fetching JavaScript files ---"
for js in $(grep -oE 'src="([^"]+\.js[^"]*)"' /tmp/dashboard.html | sed 's/src="//;s/"//'); do
  if [[ $js == /* ]]; then
    js_url="$BASE_URL$js"
  elif [[ $js != http* ]]; then
    js_url="$BASE_URL/$js"
  else
    js_url="$js"
  fi
  echo "Fetching: $js_url"
  content=$(curl -s "$js_url?api_key=$API_KEY")

  # Look for API endpoints in JS
  echo "API endpoints found:"
  echo "$content" | grep -oE '["'"'"'](/api/[^"'"'"']+|/v1/[^"'"'"']+|events[^"'"'"']*|bulk[^"'"'"']*|batch[^"'"'"']*|stream[^"'"'"']*|fast[^"'"'"']*)["'"'"']' | sort -u | head -20
  echo ""
done

# Check for WebSocket endpoints
echo "--- WebSocket references ---"
grep -oiE 'wss?://[^"'"'"' ]+' /tmp/dashboard.html
curl -s "$BASE_URL?api_key=$API_KEY" | grep -oiE 'websocket|socket\.io|ws://'
echo ""

# Look for any hints about speed/performance
echo "--- Speed/performance hints ---"
grep -oiE '(fast|speed|bulk|batch|parallel|concurrent|stream|optimize|performance)[^<>]{0,100}' /tmp/dashboard.html | head -20
echo ""

# Save full HTML for manual inspection
echo "Full HTML saved to /tmp/dashboard.html"
echo "Inspect with: cat /tmp/dashboard.html | less"
