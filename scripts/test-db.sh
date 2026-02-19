#!/bin/bash

DB_CMD="docker exec assignment-postgres psql -U postgres -d ingestion -t -A"
DB_CMD_PRETTY="docker exec assignment-postgres psql -U postgres -d ingestion"

echo "============================================================"
echo "DataSync Ingestion - Database Test Report"
echo "============================================================"
echo ""

# 1. Event Count Check
echo "=== 1. EVENT COUNT ==="
TOTAL=$($DB_CMD -c "SELECT COUNT(*) FROM ingested_events;")
EXPECTED=3000000
echo "Total events: $TOTAL"
echo "Expected:     $EXPECTED"

if [ "$TOTAL" -eq "$EXPECTED" ]; then
  echo "✓ PASS: Event count matches expected"
else
  echo "✗ FAIL: Event count mismatch (missing: $((EXPECTED - TOTAL)))"
fi
echo ""

# 2. Data Quality Checks
echo "=== 2. DATA QUALITY ==="

# Check for NULL IDs
NULL_IDS=$($DB_CMD -c "SELECT COUNT(*) FROM ingested_events WHERE id IS NULL;")
echo "Events with NULL id: $NULL_IDS"
if [ "$NULL_IDS" -eq "0" ]; then
  echo "✓ PASS: No NULL IDs"
else
  echo "✗ FAIL: Found NULL IDs"
fi

# Check for duplicate IDs (should be 0 due to PRIMARY KEY)
TOTAL_IDS=$($DB_CMD -c "SELECT COUNT(*) FROM ingested_events;")
UNIQUE_IDS=$($DB_CMD -c "SELECT COUNT(DISTINCT id) FROM ingested_events;")
echo "Total IDs: $TOTAL_IDS, Unique IDs: $UNIQUE_IDS"
if [ "$TOTAL_IDS" -eq "$UNIQUE_IDS" ]; then
  echo "✓ PASS: All IDs are unique"
else
  echo "✗ FAIL: Duplicate IDs found"
fi

# Timestamp quality check
echo ""
echo "--- Timestamp Quality ---"
NULL_TS=$($DB_CMD -c "SELECT COUNT(*) FROM ingested_events WHERE timestamp IS NULL;")
echo "Events with NULL timestamp: $NULL_TS"

ZERO_TS=$($DB_CMD -c "SELECT COUNT(*) FROM ingested_events WHERE timestamp = 0;")
echo "Events with zero timestamp: $ZERO_TS"

NEGATIVE_TS=$($DB_CMD -c "SELECT COUNT(*) FROM ingested_events WHERE timestamp < 0;")
echo "Events with negative timestamp: $NEGATIVE_TS"

# Timestamp range (should be reasonable Unix ms timestamps)
echo ""
echo "--- Timestamp Range ---"
$DB_CMD_PRETTY -c "
SELECT
  MIN(timestamp) as min_ts,
  MAX(timestamp) as max_ts,
  TO_TIMESTAMP(MIN(timestamp)/1000) as min_date,
  TO_TIMESTAMP(MAX(timestamp)/1000) as max_date
FROM ingested_events;
"

if [ "$NULL_TS" -eq "0" ] && [ "$ZERO_TS" -eq "0" ] && [ "$NEGATIVE_TS" -eq "0" ]; then
  echo "✓ PASS: All timestamps are valid"
else
  echo "✗ WARN: Some timestamps may have issues"
fi

# Check for NULL required fields
echo ""
echo "--- NULL Field Counts ---"
$DB_CMD_PRETTY -c "
SELECT
  SUM(CASE WHEN session_id IS NULL THEN 1 ELSE 0 END) as null_session_id,
  SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) as null_user_id,
  SUM(CASE WHEN type IS NULL THEN 1 ELSE 0 END) as null_type,
  SUM(CASE WHEN name IS NULL THEN 1 ELSE 0 END) as null_name
FROM ingested_events;
"

echo ""

# 3. Stats by Event Type
echo "=== 3. STATS BY EVENT TYPE ==="
$DB_CMD_PRETTY -c "
SELECT
  type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ingested_events
GROUP BY type
ORDER BY count DESC;
"

echo ""
echo "=== 4. STATS BY DEVICE TYPE ==="
$DB_CMD_PRETTY -c "
SELECT
  COALESCE(device_type, 'unknown') as device_type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ingested_events
GROUP BY device_type
ORDER BY count DESC;
"

echo ""
echo "=== 5. STATS BY BROWSER ==="
$DB_CMD_PRETTY -c "
SELECT
  COALESCE(browser, 'unknown') as browser,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM ingested_events
GROUP BY browser
ORDER BY count DESC;
"

echo ""
echo "=== 6. SAMPLE EVENTS ==="
$DB_CMD_PRETTY -c "
SELECT id, type, name, device_type, browser,
       TO_TIMESTAMP(timestamp/1000) as event_time
FROM ingested_events
LIMIT 5;
"

echo ""
echo "============================================================"
echo "Test complete"
echo "============================================================"
