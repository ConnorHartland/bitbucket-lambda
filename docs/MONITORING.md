# CloudWatch Monitoring and Alerting

This document describes the comprehensive monitoring and alerting setup for the Bitbucket Teams Webhook integration.

## Overview

The monitoring system provides:
- **Custom Metrics**: Event types, failures, and performance metrics
- **CloudWatch Alarms**: Automated alerting for errors and performance issues
- **SNS Notifications**: Email alerts for critical issues
- **Log-based Metrics**: Metrics extracted from application logs

## Custom Metrics

### Event Type Metrics
- **Namespace**: `BitbucketTeamsWebhook/EventTypes`
- **Metrics**: Individual counters for each event type (e.g., `EventType-pullrequest-created`)
- **Purpose**: Track webhook activity by event type

### Failure Metrics
- **Namespace**: `BitbucketTeamsWebhook`
- **Metrics**:
  - `SignatureVerificationFailures`: Invalid webhook signatures
  - `TeamsAPIFailures`: Failed Teams API calls
  - `UnsupportedEventTypes`: Events not supported by the handler
- **Purpose**: Monitor security and integration issues

### Performance Metrics
- **Namespace**: `BitbucketTeamsWebhook`
- **Metrics**:
  - `ProcessingDuration`: End-to-end processing time in milliseconds
- **Purpose**: Monitor performance and identify bottlenecks

## CloudWatch Alarms

### Lambda Function Alarms

#### Lambda Errors
- **Alarm**: `bitbucket-teams-lambda-errors`
- **Threshold**: > 5 errors in 5 minutes (configurable)
- **Purpose**: Detect function failures

#### Lambda Error Rate
- **Alarm**: `bitbucket-teams-lambda-error-rate`
- **Threshold**: > 5% error rate (configurable)
- **Purpose**: Detect degraded service quality

#### Lambda Duration
- **Alarm**: `bitbucket-teams-lambda-duration`
- **Threshold**: > 25 seconds average (configurable)
- **Purpose**: Detect performance issues approaching timeout

#### Lambda Throttles
- **Alarm**: `bitbucket-teams-lambda-throttles`
- **Threshold**: > 0 throttles
- **Purpose**: Detect concurrency limit issues

### API Gateway Alarms

#### 4XX Errors
- **Alarm**: `bitbucket-teams-api-4xx-errors`
- **Threshold**: > 10 errors in 5 minutes (configurable)
- **Purpose**: Detect client-side issues (bad requests, auth failures)

#### 5XX Errors
- **Alarm**: `bitbucket-teams-api-5xx-errors`
- **Threshold**: > 0 errors in 5 minutes
- **Purpose**: Detect server-side issues

### Application-Specific Alarms

#### Signature Verification Failures
- **Alarm**: `bitbucket-teams-signature-failures`
- **Threshold**: > 10 failures per hour (configurable)
- **Purpose**: Detect potential security issues or configuration problems

#### Teams API Failures
- **Alarm**: `bitbucket-teams-api-failures`
- **Threshold**: > 5 failures in 5 minutes (configurable)
- **Purpose**: Detect Teams connectivity or authentication issues

#### Unsupported Event Types
- **Alarm**: `bitbucket-teams-unsupported-events`
- **Threshold**: > 50 events per hour (configurable)
- **Purpose**: Detect configuration issues or new event types

## SNS Notifications

### Topic Configuration
- **Topic**: `bitbucket-teams-webhook-alerts`
- **Subscriptions**: Email endpoints (configurable)
- **Permissions**: CloudWatch alarms can publish to the topic

### Email Notifications
Configure email endpoints in `terraform.tfvars`:
```hcl
alarm_email_endpoints = [
  "devops@yourcompany.com",
  "alerts@yourcompany.com"
]
```

## Configuration

### Enabling/Disabling Monitoring
```hcl
# Disable all monitoring alarms
enable_monitoring_alarms = false

# Enable monitoring with default thresholds
enable_monitoring_alarms = true
```

### Customizing Alarm Thresholds
```hcl
# Lambda error thresholds
lambda_error_threshold      = 10    # Number of errors
lambda_error_rate_threshold = 0.10  # 10% error rate
lambda_duration_threshold   = 20000 # 20 seconds

# Security thresholds
signature_failure_threshold = 20    # Per hour

# Integration thresholds
teams_api_failure_threshold = 10    # Number of failures
api_gateway_4xx_threshold   = 20    # Number of 4XX errors

# Configuration thresholds
unsupported_events_threshold = 100  # Per hour
```

## Log Metric Filters

The system uses CloudWatch Log Metric Filters to extract metrics from application logs:

### Signature Verification Failures
- **Pattern**: `[timestamp, request_id, level="WARN", message="*signature*"]`
- **Metric**: `SignatureVerificationFailures`

### Teams API Failures
- **Pattern**: `[timestamp, request_id, level="ERROR", message="*Teams*"]`
- **Metric**: `TeamsAPIFailures`

### Event Types
- **Pattern**: `[timestamp, request_id, level, event_type="<event_type>", ...]`
- **Metrics**: Individual metrics per event type

### Unsupported Events
- **Pattern**: `[timestamp, request_id, level, message="*unsupported*event*type*"]`
- **Metric**: `UnsupportedEventTypes`

## Embedded Metric Format (EMF)

The Lambda function uses CloudWatch Embedded Metric Format to emit custom metrics directly from logs without additional API calls. This provides:

- **Zero latency**: Metrics are emitted synchronously with log entries
- **Cost efficiency**: No additional CloudWatch API calls
- **Automatic parsing**: CloudWatch automatically extracts metrics from structured logs

### Example EMF Log Entry
```json
{
  "_aws": {
    "Timestamp": 1670000000000,
    "CloudWatchMetrics": [
      {
        "Namespace": "BitbucketTeamsWebhook",
        "Dimensions": [["EventType"]],
        "Metrics": [
          {
            "Name": "EventType-pullrequest-created",
            "Unit": "Count"
          }
        ]
      }
    ]
  },
  "EventType-pullrequest-created": 1,
  "EventType": "pullrequest:created"
}
```

## Monitoring Best Practices

### Alarm Actions
- **Critical alarms**: Immediate notification (5XX errors, Lambda errors)
- **Warning alarms**: Delayed notification (4XX errors, high unsupported events)
- **OK actions**: Send recovery notifications

### Threshold Tuning
- Start with conservative thresholds
- Monitor false positive rates
- Adjust based on actual traffic patterns
- Consider business hours vs. off-hours thresholds

### Dashboard Creation
Consider creating CloudWatch dashboards for:
- Event type distribution
- Error rates over time
- Processing duration trends
- Teams API success rates

### Log Analysis
Use CloudWatch Logs Insights for detailed analysis:
```sql
fields @timestamp, event_type, repository, processing_duration_ms
| filter @message like /Successfully posted/
| stats avg(processing_duration_ms) by event_type
```

## Troubleshooting

### High Signature Failures
1. Check Bitbucket webhook configuration
2. Verify webhook secret in Secrets Manager
3. Check for IP allowlist issues

### Teams API Failures
1. Verify Teams webhook URL is valid
2. Check Teams channel permissions
3. Test URL manually with curl

### High Processing Duration
1. Check Secrets Manager response times
2. Monitor Teams API response times
3. Consider increasing Lambda memory

### Missing Metrics
1. Verify EMF log format is correct
2. Check CloudWatch Logs for structured entries
3. Ensure log retention allows metric extraction

## Cost Considerations

### CloudWatch Costs
- **Metrics**: $0.30 per metric per month (first 10,000 metrics free)
- **Alarms**: $0.10 per alarm per month (first 10 alarms free)
- **Log storage**: $0.50 per GB per month
- **Log ingestion**: $0.50 per GB

### Optimization Tips
- Use log-based metrics instead of API-based metrics
- Set appropriate log retention periods
- Consolidate related metrics where possible
- Use composite alarms for complex conditions

## Security Considerations

### Log Sanitization
- Webhook signatures are automatically redacted from logs
- Secrets are never logged in plain text
- Request IDs allow correlation without exposing sensitive data

### Alarm Notifications
- Email notifications may contain sensitive information
- Consider using SNS → Lambda → Slack for filtered notifications
- Implement proper access controls on SNS topics