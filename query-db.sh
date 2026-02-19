#!/bin/bash

DB_CMD="docker exec assignment-postgres psql -U postgres -d ingestion"

echo "=== Event Count ==="
$DB_CMD -c "SELECT COUNT(*) as total_events FROM ingested_events;"

echo ""
echo "=== Sample Events (5) ==="
$DB_CMD -c "SELECT id, type, name, user_id, device_type, browser, timestamp FROM ingested_events LIMIT 5;"

echo ""
echo "=== Events by Type ==="
$DB_CMD -c "SELECT type, COUNT(*) as count FROM ingested_events GROUP BY type ORDER BY count DESC;"

echo ""
echo "=== Checkpoint Status ==="
$DB_CMD -c "SELECT id, events_ingested, last_updated FROM checkpoints ORDER BY id DESC LIMIT 3;"
