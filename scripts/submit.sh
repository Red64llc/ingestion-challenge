#!/bin/bash
set -e

# Configuration - UPDATE THESE BEFORE SUBMITTING
API_KEY="${API_KEY:-YOUR_API_KEY}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/YOUR_USERNAME/YOUR_REPO}"
SUBMISSION_ENDPOINT="http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Submission Script ===${NC}"

# Check if API_KEY is set
if [ "$API_KEY" = "YOUR_API_KEY" ]; then
    echo -e "${RED}Error: Set API_KEY environment variable${NC}"
    echo "Usage: API_KEY=your_key GITHUB_REPO=your_repo ./scripts/submit.sh"
    exit 1
fi

# Check if GITHUB_REPO is set
if [ "$GITHUB_REPO" = "https://github.com/YOUR_USERNAME/YOUR_REPO" ]; then
    echo -e "${RED}Error: Set GITHUB_REPO environment variable${NC}"
    echo "Usage: API_KEY=your_key GITHUB_REPO=your_repo ./scripts/submit.sh"
    exit 1
fi

# Step 1: Export event IDs from PostgreSQL
echo -e "${YELLOW}Step 1: Exporting event IDs from database...${NC}"
EVENT_IDS_FILE="/tmp/event_ids.txt"

docker compose exec -T db psql -U postgres -d flowtel -t -A -c \
    "SELECT id FROM events ORDER BY id;" > "$EVENT_IDS_FILE"

EVENT_COUNT=$(wc -l < "$EVENT_IDS_FILE" | tr -d ' ')
echo -e "${GREEN}Exported $EVENT_COUNT event IDs${NC}"

# Step 2: Push latest code to GitHub
echo -e "${YELLOW}Step 2: Pushing latest code to GitHub...${NC}"
git add -A
git commit -m "Submission commit" --allow-empty
git push origin main

echo -e "${GREEN}Code pushed to GitHub${NC}"

# Step 3: Submit to API
echo -e "${YELLOW}Step 3: Submitting to API...${NC}"
echo "Repository: $GITHUB_REPO"
echo "Event count: $EVENT_COUNT"

RESPONSE=$(curl -s -X POST \
    "${SUBMISSION_ENDPOINT}?repository=${GITHUB_REPO}" \
    -H "X-API-Key: ${API_KEY}" \
    -H "Content-Type: text/plain" \
    --data-binary @"$EVENT_IDS_FILE")

echo -e "${GREEN}=== Submission Response ===${NC}"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Cleanup
rm -f "$EVENT_IDS_FILE"

echo -e "${GREEN}=== Done ===${NC}"
