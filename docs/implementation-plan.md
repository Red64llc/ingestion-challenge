# DataSync Ingestion Challenge - Implementation Plan

## Challenge Overview

Build a production-ready system that extracts **3 million events** from the DataSync Analytics API and stores them in PostgreSQL, running entirely in Docker.

**Base URL:** `http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1`

**Key Constraints:**
- TypeScript codebase
- PostgreSQL for persistence
- Docker Compose orchestration
- Entry point: `sh run-ingestion.sh`
- API key valid for 3 hours
- Maximum 5 submissions per API key
- Target: Complete in under 30 minutes

---

## API Response Structure

Based on sample response from `/api/v1/events`:

```json
{
  "data": [
    {
      "id": "56a349b5-7243-4e0c-9fd8-f2c1eb2a5d35",
      "sessionId": "0ae5e27f-bcc5-4d99-b744-3ce64d3623a9",
      "userId": "1f2a12b4-1bdc-463d-ba74-f6d849f5b76f",
      "type": "click",
      "name": "event_e8o287",
      "properties": { "page": "/home" },
      "timestamp": 1769541612369,
      "session": {
        "id": "0ae5e27f-bcc5-4d99-b744-3ce64d3623a9",
        "deviceType": "tablet",
        "browser": "Edge"
      }
    }
  ],
  "pagination": {
    "limit": 100,
    "hasMore": true,
    "nextCursor": "eyJpZCI6...",
    "cursorExpiresIn": 116
  },
  "meta": {
    "total": 3000000,
    "returned": 100,
    "requestId": "868fa3cf-f987-4e1b-b1af-a6aeaaecd8b9"
  }
}
```

### Key Observations

| Finding | Value | Impact |
|---------|-------|--------|
| Events per page | 100 | Need 30,000 requests for 3M events |
| Pagination type | Cursor-based | Must use `nextCursor` parameter |
| Cursor expiry | ~116 seconds | Must process quickly or cursor expires |
| Timestamp format | Mixed (Unix ms / ISO string) | Need normalization if storing |
| Total events | 3,000,000 | Confirmed |

---

## Throughput Calculation

```
3,000,000 events ÷ 100 per page = 30,000 API requests
Target: 30 minutes = 1,800 seconds
Required rate: 30,000 ÷ 1,800 = ~17 requests/second

With cursor expiry of ~116 seconds:
- Must fetch next page before cursor expires
- Consider parallel cursor chains if API supports it
```

---

## Project Structure

```
Flowtel/
├── docker-compose.yml          # PostgreSQL + App services
├── Dockerfile                  # Node.js 20 TypeScript app
├── run-ingestion.sh           # Entry point script
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── src/
    ├── index.ts               # Main entry point
    ├── config.ts              # Environment configuration
    ├── db/
    │   └── client.ts          # PostgreSQL connection + batch insert
    ├── api/
    │   ├── client.ts          # HTTP client with retry/rate limiting
    │   └── types.ts           # TypeScript interfaces
    ├── ingestion/
    │   ├── fetcher.ts         # Page fetcher with cursor handling
    │   └── checkpoint.ts      # Resume/checkpoint logic
    └── submission/
        └── submit.ts          # Final submission logic
```

---

## Database Schema

```sql
-- Simplified: Only store what we need for submission
CREATE TABLE events (
    id VARCHAR(36) PRIMARY KEY
);

-- Checkpoint for resumability (cursor-based)
CREATE TABLE checkpoints (
    id SERIAL PRIMARY KEY,
    next_cursor TEXT,
    events_ingested INTEGER,
    last_updated TIMESTAMP DEFAULT NOW()
);
```

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  API Client     │────▶│  Rate Limiter    │────▶│  Page Fetcher   │
│  (axios/retry)  │     │  (token bucket)  │     │  (cursor-based) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                        ┌──────────────────┐            │
                        │  Checkpoint      │◀───────────┤
                        │  Manager         │            │
                        └──────────────────┘            ▼
                                              ┌─────────────────┐
                                              │  PostgreSQL     │
                                              │  (batch insert) │
                                              └─────────────────┘
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup

**Files:**
- `docker-compose.yml` - PostgreSQL 15 + Node.js app
- `Dockerfile` - Multi-stage build for TypeScript
- `run-ingestion.sh` - Entry script
- `package.json` - Dependencies (axios, pg, typescript)
- `tsconfig.json` - TypeScript configuration

**Docker Compose Services:**
```yaml
services:
  postgres:
    image: postgres:15
    ports:
      - "5434:5432"
    environment:
      POSTGRES_DB: events
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres

  app:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/events
      API_KEY: ${API_KEY}
```

### Phase 2: API Client Layer

**Features:**
- HTTP client with axios
- Automatic retry with exponential backoff
- Rate limit detection (429 status)
- Response header inspection
- Request/response logging

**Key Code:**
```typescript
async function fetchPage(cursor?: string): Promise<ApiResponse> {
  const url = cursor
    ? `${API_URL}/events?cursor=${cursor}`
    : `${API_URL}/events`;

  const response = await axios.get(url, {
    headers: { 'X-API-Key': API_KEY },
    timeout: 10000
  });

  return response.data;
}
```

### Phase 3: Ingestion Pipeline

**Main Loop:**
```typescript
let cursor: string | null = null;
let totalIngested = 0;

while (true) {
  const response = await fetchPage(cursor);

  // Batch insert event IDs
  await batchInsertIds(response.data.map(e => e.id));
  totalIngested += response.data.length;

  // Save checkpoint after each page
  await saveCheckpoint(response.pagination.nextCursor, totalIngested);

  // Log progress
  console.log(`Progress: ${totalIngested} / 3,000,000 (${(totalIngested/30000).toFixed(1)}%)`);

  if (!response.pagination.hasMore) break;
  cursor = response.pagination.nextCursor;
}
```

**Efficient Batch Insert:**
```typescript
async function batchInsertIds(ids: string[]): Promise<void> {
  await db.query(`
    INSERT INTO events (id)
    SELECT UNNEST($1::varchar[])
    ON CONFLICT DO NOTHING
  `, [ids]);
}
```

### Phase 4: Resumability

**Checkpoint Save:**
```typescript
async function saveCheckpoint(cursor: string, count: number): Promise<void> {
  await db.query(`
    INSERT INTO checkpoints (next_cursor, events_ingested)
    VALUES ($1, $2)
  `, [cursor, count]);
}
```

**Checkpoint Load (on startup):**
```typescript
async function loadCheckpoint(): Promise<{ cursor: string; count: number } | null> {
  const result = await db.query(`
    SELECT next_cursor, events_ingested
    FROM checkpoints
    ORDER BY id DESC
    LIMIT 1
  `);
  return result.rows[0] || null;
}
```

### Phase 5: Submission

**Export and Submit:**
```typescript
async function submit(): Promise<void> {
  // Query all event IDs
  const result = await db.query('SELECT id FROM events');
  const ids = result.rows.map(r => r.id).join('\n');

  // Submit to API
  const response = await axios.post(`${API_URL}/submissions`, ids, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'text/plain'
    }
  });

  console.log('Submission result:', response.data);
}
```

---

## Parallelization Strategies

### Option A: Single Cursor Chain (Baseline)
- Sequential requests following cursor
- Simple implementation
- ~17 req/sec needed

### Option B: Multiple Cursor Chains
- If API supports starting at different offsets
- Each worker maintains its own cursor
- Higher throughput potential

### Option C: Timestamp Partitioning
- If API supports timestamp filters
- Divide time range into chunks
- Each worker handles a chunk

**Recommended:** Start with Option A, optimize if needed.

---

## Error Handling

| Error Type | Strategy |
|------------|----------|
| Network timeout | Retry with exponential backoff (max 3 retries) |
| 429 Rate Limited | Wait for `Retry-After` header, then retry |
| 5xx Server Error | Retry with backoff |
| Cursor expired | Resume from last checkpoint |
| DB connection lost | Reconnect with backoff |

**Retry Logic:**
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Cursor expires (116s) | Process each page immediately, checkpoint after each |
| Rate limiting | Implement backoff, watch for 429 responses |
| Network failures | Retry with exponential backoff + checkpoint |
| Duplicate inserts | `ON CONFLICT DO NOTHING` in SQL |
| API key expires (3hr) | Design for <30 min completion |
| Process crash | Checkpoint system enables resume |

---

## Success Metrics

- [ ] All 3,000,000 events ingested
- [ ] Completion time < 30 minutes
- [ ] Zero data loss on crash/restart
- [ ] Successful submission accepted by API
- [ ] Runs fully automated in Docker

---

## Dependencies

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/pg": "^8.10.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0"
  }
}
```

---

## Execution Flow

```
1. run-ingestion.sh
   └── docker-compose up
       ├── PostgreSQL starts
       └── App container starts
           └── src/index.ts
               ├── Initialize DB connection
               ├── Run migrations (create tables)
               ├── Check for existing checkpoint
               │   ├── If exists: resume from cursor
               │   └── If not: start fresh
               ├── Begin ingestion loop
               │   ├── Fetch page
               │   ├── Insert IDs
               │   ├── Save checkpoint
               │   └── Repeat until hasMore=false
               └── Submit all IDs to API
```
