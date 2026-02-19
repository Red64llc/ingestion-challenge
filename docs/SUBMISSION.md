# Submission Process

## Quick Checklist

- [ ] Code pushed to GitHub repo
- [ ] `run-ingestion.sh` works from clean state
- [ ] Docker Compose runs without manual intervention
- [ ] Solution is resumable after failures

## Submit via API

**Endpoint:** `POST http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions`

**Max 5 submissions per API key**

### Option A: Plain text (recommended)

```bash
curl -X POST \
  "http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions?repository=https://github.com/YOUR_USERNAME/YOUR_REPO" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: text/plain" \
  --data-binary @event_ids.txt
```

### Option B: JSON

```bash
curl -X POST \
  "http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ids": [...], "repository": "https://github.com/YOUR_USERNAME/YOUR_REPO"}'
```

## Response

- Submission ID
- Event count verification
- Completion time (measured from first API call)
- Remaining submission attempts

## Evaluation Criteria

| Category                      | Weight |
|-------------------------------|--------|
| **API Discovery & Throughput** | 60%    |
| Job Processing Architecture   | 40%    |

**Target:** Top performers complete 3M events in under 30 minutes.

## Requirements Summary

### Must Have
- TypeScript codebase
- PostgreSQL data storage
- Docker Compose execution via `sh run-ingestion.sh`
- Error handling and logging
- Rate limit handling
- Resumable ingestion after failures

### Should Have
- Throughput optimization
- Progress tracking display
- Worker health monitoring

### Nice to Have
- Unit and integration tests
- Metrics/monitoring systems
- Architecture documentation
