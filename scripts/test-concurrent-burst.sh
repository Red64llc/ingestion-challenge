#!/bin/bash

API_BASE="${API_BASE_URL:-http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1}"

if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY required"
  exit 1
fi

echo "=== Testing Concurrent Burst Requests ==="
echo "Firing 10 requests simultaneously..."
echo ""

# Fire 10 concurrent requests and time them
start=$(date +%s.%N)

for i in {1..10}; do
  (
    response=$(curl -s -w "\n%{http_code}|%{time_total}" "$API_BASE/events?limit=5000" -H "X-API-Key: $API_KEY")
    status=$(echo "$response" | tail -1 | cut -d'|' -f1)
    time=$(echo "$response" | tail -1 | cut -d'|' -f2)
    events=$(echo "$response" | head -n -1 | jq -r '.meta.returned // "error"' 2>/dev/null)
    echo "Request $i: status=$status, time=${time}s, events=$events"
  ) &
done

wait
end=$(date +%s.%N)
elapsed=$(echo "$end - $start" | bc)

echo ""
echo "Total time for 10 concurrent requests: ${elapsed}s"
echo "If all succeeded: 50,000 events in ${elapsed}s = $(echo "50000 / $elapsed" | bc) events/sec"
echo ""

# Wait for rate limit to reset
echo "Waiting 30s for rate limit reset..."
sleep 30

echo ""
echo "=== Testing Sequential vs Concurrent ==="
echo "Sequential 5 requests..."
start=$(date +%s.%N)
for i in {1..5}; do
  curl -s "$API_BASE/events?limit=5000" -H "X-API-Key: $API_KEY" > /dev/null
  echo "Request $i done"
done
end=$(date +%s.%N)
seq_time=$(echo "$end - $start" | bc)
echo "Sequential time: ${seq_time}s"

sleep 30

echo ""
echo "Concurrent 5 requests..."
start=$(date +%s.%N)
for i in {1..5}; do
  curl -s "$API_BASE/events?limit=5000" -H "X-API-Key: $API_KEY" > /dev/null &
done
wait
end=$(date +%s.%N)
conc_time=$(echo "$end - $start" | bc)
echo "Concurrent time: ${conc_time}s"

echo ""
echo "Speedup: $(echo "$seq_time / $conc_time" | bc -l | head -c 4)x"
