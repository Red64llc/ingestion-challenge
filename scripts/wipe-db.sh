#!/bin/bash
set -e

echo "Wiping database..."

docker exec assignment-postgres psql -U postgres -d ingestion -c "
  DROP TABLE IF EXISTS ingested_events CASCADE;
  DROP TABLE IF EXISTS checkpoints CASCADE;
"

echo "Database wiped successfully."
echo "Tables dropped: ingested_events, checkpoints"
