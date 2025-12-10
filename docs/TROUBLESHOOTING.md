# Troubleshooting Guide

This guide helps diagnose and resolve common issues with the Bitbucket Teams Webhook integration.

## Quick Diagnostics

### Health Check Commands

```bash
# Check Lambda function status
aws lambda get-function --function-name bitbucket-teams-notifier

# Check recent logs
aws logs tail /aws/lambda/bitbucket-teams-notifier --follow

# Test webhook endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Event-Key: repo:push" \
  -d '{"test": true}' \
  "$(terraform output -raw webhook_url)"

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace "AWS/Lambda" \
  --metric-name "Invocations" \
  --dimensions Name=FunctionName,Value=bitbucket-teams-notifier \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Common Issues

### 1. Webhook Not Triggering

#### Symptoms
- No CloudWatch logs for webhook events
- Bitbucket shows webhook delivery failures
- Teams channel receives no messages

#### Diagnosis Steps

1. **Check Bitbucket Webhook Configuration**:
   ```bash
   # Verify webhook URL matches Terraform output
   terraform output webhook_url
   
   # Check webhook status in Bitbucket
   # Go to Repository Settings → Webhooks → View Recent Deliveries
   ```

2. **Verify API Gateway**:
   ```bash
   # Check API Gateway configuration
   aws apigatewayv2 get-apis --query 'Items[?Name==`bitbucket-teams-webhook-api`]'
   
   # Test API Gateway directly
   curl -X POST "$(terraform output -raw webhook_url)" \
     -H "Content-Type: application/json" \
     -d '{"test": "payload"}'
   ```

3. **Check Lambda Function**:
   ```bash
   # Verify Lambda function exists and is active
   aws lambda get-function-configuration \
     --function-name bitbucket-teams-notifier
   
   # Check Lambda permissions
   aws lambda get-policy --function-name bitbucket-teams-notifier
   ```

#### Common Causes and Solutions

| Cause | Solution |
|-------|----------|
| **Wrong webhook URL** | Copy exact URL from `terraform output webhook_url` |
| **API Gateway not deployed** | Run `terraform apply` to ensure deployment |
| **Lambda function not found** | Check function name and region |
| **Missing Lambda permissions** | Verify API Gateway has invoke permission |

### 2. Signature Verification Failures

#### Symptoms
- HTTP 401 responses from webhook
- "Signature verification failed" in CloudWatch logs
- Bitbucket shows authentication errors

#### Diagnosis Steps

1. **Check Webhook Secret Configuration**:
   ```bash
   # Verify secret in Secrets Manager
   aws secretsmanager get-secret-value \
     --secret-id "$(terraform output -raw webhook_secret_arn)" \
     --query 'SecretString' --output text
   
   # Compare with Bitbucket webhook configuration
   ```

2. **Test Signature Generation**:
   ```bash
   # Generate test signature
   SECRET="your-webhook-secret"
   PAYLOAD='{"test": "data"}'
   SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
   echo "Expected signature: sha256=$SIGNATURE"
   ```

3. **Check Request Headers**:
   ```bash
   # Look for signature verification logs
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --filter-pattern "signature" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

#### Common Causes and Solutions

| Cause | Solution |
|-------|----------|
| **Secret mismatch** | Ensure Bitbucket webhook secret matches Terraform variable |
| **Wrong signature format** | Bitbucket sends `sha256=<hex>`, verify format |
| **Secret not found** | Check Secrets Manager ARN and Lambda permissions |
| **Encoding issues** | Ensure UTF-8 encoding for secret and payload |

### 3. Teams Messages Not Appearing

#### Symptoms
- Webhook processes successfully (HTTP 200)
- CloudWatch logs show "Successfully posted to Teams"
- No messages appear in Teams channel

#### Diagnosis Steps

1. **Verify Teams Webhook URL**:
   ```bash
   # Get Teams URL from Secrets Manager
   aws secretsmanager get-secret-value \
     --secret-id "$(terraform output -raw teams_url_secret_arn)" \
     --query 'SecretString' --output text
   
   # Test Teams URL manually
   curl -X POST "https://your-teams-webhook-url" \
     -H "Content-Type: application/json" \
     -d '{"text": "Test message from curl"}'
   ```

2. **Check Teams API Response**:
   ```bash
   # Look for Teams API errors in logs
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --filter-pattern "Teams API" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

3. **Validate Message Format**:
   ```bash
   # Check for message formatting errors
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --filter-pattern "format.*message" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

#### Common Causes and Solutions

| Cause | Solution |
|-------|----------|
| **Invalid Teams URL** | Regenerate webhook in Teams, update Secrets Manager |
| **Teams channel deleted** | Verify channel exists and webhook is active |
| **Message format invalid** | Check CloudWatch logs for JSON formatting errors |
| **Teams service outage** | Check Microsoft 365 service status |

### 4. Event Filtering Issues

#### Symptoms
- Webhook triggers but no Teams messages
- "Event filtered out" in CloudWatch logs
- Only some events are processed

#### Diagnosis Steps

1. **Check Filter Configuration**:
   ```bash
   # Check Lambda environment variables
   aws lambda get-function-configuration \
     --function-name bitbucket-teams-notifier \
     --query 'Environment.Variables'
   ```

2. **Verify Event Types**:
   ```bash
   # Look for filtering decisions in logs
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --filter-pattern "filter" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

3. **Test Specific Event Types**:
   ```bash
   # Test with specific event type
   curl -X POST "$(terraform output -raw webhook_url)" \
     -H "Content-Type: application/json" \
     -H "X-Event-Key: pullrequest:created" \
     -H "X-Hub-Signature: sha256=$SIGNATURE" \
     -d "$TEST_PAYLOAD"
   ```

#### Filter Mode Troubleshooting

| Filter Mode | Expected Behavior | Troubleshooting |
|-------------|-------------------|-----------------|
| `all` | Processes events in `EVENT_FILTER` | Check if event type is in the filter list |
| `deployments` | Only build/pipeline events | Verify event is deployment-related |
| `failures` | Only failure events | Check if event represents a failure state |

### 5. Lambda Function Errors

#### Symptoms
- HTTP 500 responses from webhook
- Lambda error metrics in CloudWatch
- Exception traces in logs

#### Diagnosis Steps

1. **Check Lambda Logs**:
   ```bash
   # Get recent error logs
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --filter-pattern "ERROR" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

2. **Check Lambda Metrics**:
   ```bash
   # Check error rate
   aws cloudwatch get-metric-statistics \
     --namespace "AWS/Lambda" \
     --metric-name "Errors" \
     --dimensions Name=FunctionName,Value=bitbucket-teams-notifier \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

3. **Test Lambda Function**:
   ```bash
   # Invoke Lambda directly for testing
   aws lambda invoke \
     --function-name bitbucket-teams-notifier \
     --payload '{"body": "{\"test\": true}", "headers": {"X-Event-Key": "repo:push"}}' \
     response.json
   
   cat response.json
   ```

#### Common Lambda Errors

| Error Type | Cause | Solution |
|------------|-------|----------|
| **Configuration Error** | Missing environment variables | Check Terraform configuration |
| **Permission Error** | IAM role lacks permissions | Verify IAM policy attachments |
| **Timeout Error** | Function exceeds timeout | Increase `lambda_timeout` |
| **Memory Error** | Insufficient memory allocation | Increase `lambda_memory_size` |
| **Import Error** | Missing dependencies | Check Lambda deployment package |

### 6. Performance Issues

#### Symptoms
- Slow webhook responses (>5 seconds)
- Lambda duration approaching timeout
- Intermittent timeouts

#### Diagnosis Steps

1. **Analyze Processing Duration**:
   ```bash
   # Check processing duration metrics
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --filter-pattern "processing_duration_ms" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

2. **Monitor Cold Starts**:
   ```bash
   # Look for cold start indicators
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --filter-pattern "INIT_START" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

3. **Check External Dependencies**:
   ```bash
   # Monitor Secrets Manager response times
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --filter-pattern "Retrieving secret" \
     --start-time $(date -d '1 hour ago' +%s)000
   ```

#### Performance Optimization

| Issue | Solution |
|-------|----------|
| **Cold starts** | Increase memory or use provisioned concurrency |
| **Secrets Manager delays** | Secrets are cached after first retrieval |
| **Teams API slow** | Check Teams service status, increase timeout |
| **Large payloads** | Optimize JSON parsing and message formatting |

## Advanced Troubleshooting

### Debug Mode

Enable detailed logging by modifying the Lambda function:

```python
# Add to lambda_function.py
import logging
logging.getLogger().setLevel(logging.DEBUG)

# Add debug logging throughout the function
logger.debug(f"Received headers: {headers}")
logger.debug(f"Payload size: {len(body_str)} bytes")
logger.debug(f"Parsed event: {parsed_event}")
```

### Custom Metrics Analysis

Query custom metrics for detailed analysis:

```bash
# Check signature failure rate
aws cloudwatch get-metric-statistics \
  --namespace "BitbucketTeamsWebhook" \
  --metric-name "SignatureVerificationFailures" \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# Check Teams API failure rate
aws cloudwatch get-metric-statistics \
  --namespace "BitbucketTeamsWebhook" \
  --metric-name "TeamsAPIFailures" \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### Log Analysis Queries

Use CloudWatch Logs Insights for advanced analysis:

#### Find Error Patterns
```sql
fields @timestamp, @message, error_type, event_type
| filter level = "ERROR"
| stats count() as error_count by error_type
| sort error_count desc
```

#### Analyze Processing Performance
```sql
fields @timestamp, processing_duration_ms, event_type, repository
| filter @message like /processing_duration_ms/
| stats avg(processing_duration_ms) as avg_duration, 
        max(processing_duration_ms) as max_duration,
        count() as event_count by event_type
| sort avg_duration desc
```

#### Security Analysis
```sql
fields @timestamp, @message, request_id
| filter level = "WARN" and @message like /signature/
| stats count() as failure_count by bin(1h)
| sort @timestamp desc
```

#### Repository Activity Analysis
```sql
fields @timestamp, repository, event_type, action
| filter @message like /Successfully posted/
| stats count() as activity_count by repository, event_type
| sort activity_count desc
```

## Monitoring and Alerting

### CloudWatch Alarms

Check if monitoring alarms are firing:

```bash
# List all alarms
aws cloudwatch describe-alarms \
  --alarm-names \
    "bitbucket-teams-lambda-errors" \
    "bitbucket-teams-lambda-error-rate" \
    "bitbucket-teams-signature-failures" \
    "bitbucket-teams-api-failures"

# Check alarm history
aws cloudwatch describe-alarm-history \
  --alarm-name "bitbucket-teams-lambda-errors" \
  --max-records 10
```

### Custom Monitoring Script

Create a monitoring script for regular health checks:

```bash
#!/bin/bash
# webhook-health-check.sh

WEBHOOK_URL=$(terraform output -raw webhook_url)
SECRET="your-webhook-secret"

# Test payload
PAYLOAD='{"repository":{"full_name":"test/health-check"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send health check
RESPONSE=$(curl -s -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "X-Event-Key: repo:push" \
  -H "X-Hub-Signature: sha256=$SIGNATURE" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL")

HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Webhook health check passed"
  exit 0
else
  echo "❌ Webhook health check failed: HTTP $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi
```

## Recovery Procedures

### Webhook Endpoint Recovery

If the webhook endpoint is completely unresponsive:

1. **Check Infrastructure**:
   ```bash
   terraform plan
   terraform apply  # Re-apply if needed
   ```

2. **Redeploy Lambda Function**:
   ```bash
   # Package and update Lambda code
   cd lambda
   zip -r ../lambda_function.zip .
   cd ..
   
   aws lambda update-function-code \
     --function-name bitbucket-teams-notifier \
     --zip-file fileb://lambda_function.zip
   ```

3. **Verify Recovery**:
   ```bash
   # Test webhook endpoint
   curl -X POST "$(terraform output -raw webhook_url)" \
     -H "Content-Type: application/json" \
     -d '{"test": "recovery"}'
   ```

### Secret Rotation Recovery

If secrets are compromised or rotated:

1. **Update Secrets Manager**:
   ```bash
   # Update Teams URL
   aws secretsmanager update-secret \
     --secret-id "$(terraform output -raw teams_url_secret_arn)" \
     --secret-string "new-teams-webhook-url"
   
   # Update webhook secret
   aws secretsmanager update-secret \
     --secret-id "$(terraform output -raw webhook_secret_arn)" \
     --secret-string "new-webhook-secret"
   ```

2. **Update Bitbucket Webhook**:
   - Go to Repository Settings → Webhooks
   - Update webhook secret to match new value
   - Test webhook delivery

3. **Clear Lambda Cache**:
   ```bash
   # Force Lambda to reload secrets by updating environment
   aws lambda update-function-configuration \
     --function-name bitbucket-teams-notifier \
     --environment Variables='{
       "TEAMS_WEBHOOK_URL_SECRET_ARN": "'$(terraform output -raw teams_url_secret_arn)'",
       "BITBUCKET_SECRET_ARN": "'$(terraform output -raw webhook_secret_arn)'",
       "EVENT_FILTER": "pullrequest:created,repo:push",
       "FILTER_MODE": "all"
     }'
   ```

## Getting Help

### Information to Collect

When seeking help, collect the following information:

1. **Configuration**:
   ```bash
   terraform output
   aws lambda get-function-configuration --function-name bitbucket-teams-notifier
   ```

2. **Recent Logs**:
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/bitbucket-teams-notifier \
     --start-time $(date -d '1 hour ago' +%s)000 \
     > webhook-logs.txt
   ```

3. **Error Metrics**:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace "AWS/Lambda" \
     --metric-name "Errors" \
     --dimensions Name=FunctionName,Value=bitbucket-teams-notifier \
     --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 3600 \
     --statistics Sum
   ```

4. **Test Results**:
   ```bash
   # Include results of manual webhook test
   curl -v -X POST "$(terraform output -raw webhook_url)" \
     -H "Content-Type: application/json" \
     -H "X-Event-Key: repo:push" \
     -d '{"test": true}' 2>&1 | tee webhook-test.txt
   ```

### Support Channels

1. **Check Documentation**: Review README.md and docs/ directory
2. **Search Issues**: Look for similar problems in project issues
3. **CloudWatch Logs**: Most issues can be diagnosed from logs
4. **AWS Support**: For AWS service-specific issues
5. **Microsoft Support**: For Teams webhook issues

### Escalation Checklist

Before escalating issues:

- [ ] Checked CloudWatch logs for error messages
- [ ] Verified configuration matches documentation
- [ ] Tested webhook endpoint manually
- [ ] Confirmed Bitbucket webhook configuration
- [ ] Checked AWS service status
- [ ] Reviewed recent changes to infrastructure or configuration
- [ ] Collected diagnostic information listed above

This troubleshooting guide should help resolve most common issues with the Bitbucket Teams Webhook integration. For complex issues, the diagnostic steps and log analysis queries provide detailed insights into system behavior.