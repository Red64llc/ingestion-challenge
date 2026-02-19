

endpoint: http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1
auth: http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1?appiKey=ds_56fb714400de4eb61737736fdb4fd060

curl -X GET \
  -H "X-API-Key: ds_56fb714400de4eb61737736fdb4fd060" \
  -H "Content-Type: text/plain" \
  "http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/events"

questions:
- list of events dynamic or not?
- pagination?
- rate limits?

Todo:
[ ] identify rate limit (  2. Inspect response headers - Look for rate limit info, pagination hints)
[ ] check logs
[ ] parallization of infgestion
[ ] build database?
[ ] full events ingested (not just ids)?