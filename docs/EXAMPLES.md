# Examples and Use Cases

This document provides practical examples and common use cases for the Bitbucket Teams Webhook integration.

## Configuration Examples

### Example 1: Development Team - All Events

**Use Case**: Development team wants notifications for all pull request and push activities.

**Configuration** (`terraform.tfvars`):
```hcl
aws_region                = "us-east-1"
environment               = "dev"
teams_webhook_url         = "https://yourorg.webhook.office.com/webhookb2/abc123/IncomingWebhook/def456/ghi789"
bitbucket_webhook_secret  = "dev-webhook-secret-2024"

# Process all PR and push events
filter_mode  = "all"
event_filter = "pullrequest:created,pullrequest:updated,pullrequest:fulfilled,pullrequest:rejected,pullrequest:comment_created,repo:push"

# Development settings
lambda_timeout           = 30
lambda_memory_size       = 128
log_retention_days       = 7
enable_monitoring_alarms = true
alarm_email_endpoints    = ["dev-team@company.com"]
```

**Bitbucket Webhook Configuration**:
- **Triggers**: Pull request (Created, Updated, Merged, Declined, Comment created), Repository (Push)
- **URL**: `https://abc123.execute-api.us-east-1.amazonaws.com/prod/webhook`
- **Secret**: `dev-webhook-secret-2024`

**Expected Teams Messages**:
- New PR created: Blue message with PR details and "View in Bitbucket" button
- PR merged: Green message with merge information
- Code pushed: Purple message with commit details
- Comments: Gray message with comment preview

### Example 2: DevOps Team - Deployments Only

**Use Case**: DevOps team only wants notifications for build/deployment pipeline events.

**Configuration** (`terraform.tfvars`):
```hcl
aws_region                = "us-east-1"
environment               = "prod"
teams_webhook_url         = "https://yourorg.webhook.office.com/webhookb2/xyz789/IncomingWebhook/uvw456/rst123"
bitbucket_webhook_secret  = "prod-devops-secret-2024"

# Only deployment events
filter_mode = "deployments"
# event_filter is ignored in deployments mode

# Production settings
lambda_timeout           = 30
lambda_memory_size       = 256
log_retention_days       = 30
enable_monitoring_alarms = true
alarm_email_endpoints    = ["devops@company.com", "oncall@company.com"]

# Stricter alarm thresholds
lambda_error_threshold      = 3
teams_api_failure_threshold = 3
```

**Bitbucket Webhook Configuration**:
- **Triggers**: Repository (Commit status created, Commit status updated), Pull request (Approved, Approval removed)
- **URL**: `https://xyz789.execute-api.us-east-1.amazonaws.com/prod/webhook`
- **Secret**: `prod-devops-secret-2024`

**Expected Teams Messages**:
- Build started: Yellow message with build information
- Build succeeded: Green message with success details
- Build failed: Red message with failure information
- PR approved: Blue message indicating deployment readiness

### Example 3: Management Team - Failures Only

**Use Case**: Management team only wants to be notified of failures and issues.

**Configuration** (`terraform.tfvars`):
```hcl
aws_region                = "us-east-1"
environment               = "prod"
teams_webhook_url         = "https://yourorg.webhook.office.com/webhookb2/mgmt123/IncomingWebhook/exec456/lead789"
bitbucket_webhook_secret  = "mgmt-alerts-secret-2024"

# Only failure events
filter_mode = "failures"
# event_filter is ignored in failures mode

# Conservative settings for management notifications
lambda_timeout           = 30
lambda_memory_size       = 128
log_retention_days       = 90  # Longer retention for audit
enable_monitoring_alarms = true
alarm_email_endpoints    = ["management@company.com", "cto@company.com"]
```

**Bitbucket Webhook Configuration**:
- **Triggers**: Repository (Commit status updated), Pull request (Declined)
- **URL**: `https://mgmt123.execute-api.us-east-1.amazonaws.com/prod/webhook`
- **Secret**: `mgmt-alerts-secret-2024`

**Expected Teams Messages**:
- Build failures: Red message with failure details
- Declined PRs: Red message with decline reason
- No messages for successful builds or merged PRs

## Teams Message Examples

### Pull Request Created

```json
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "themeColor": "#0078D4",
  "summary": "my-repo/backend: Add user authentication API",
  "sections": [
    {
      "activityTitle": "Add user authentication API",
      "activitySubtitle": "by John Developer",
      "facts": [
        {"name": "Repository", "value": "my-repo/backend"},
        {"name": "Action", "value": "Created"},
        {"name": "Author", "value": "John Developer"},
        {"name": "Source Branch", "value": "feature/auth-api"},
        {"name": "Target Branch", "value": "main"},
        {"name": "PR ID", "value": "42"}
      ],
      "markdown": true
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View in Bitbucket",
      "targets": [
        {"os": "default", "uri": "https://bitbucket.org/myorg/backend/pull-requests/42"}
      ]
    }
  ]
}
```

### Build Failure

```json
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "themeColor": "#DC3545",
  "summary": "my-repo/frontend: Build failed",
  "sections": [
    {
      "activityTitle": "Build failed",
      "activitySubtitle": "by System",
      "facts": [
        {"name": "Repository", "value": "my-repo/frontend"},
        {"name": "Build", "value": "CI Pipeline"},
        {"name": "Status", "value": "FAILED"},
        {"name": "Commit", "value": "a1b2c3d4"},
        {"name": "Description", "value": "Tests failed: 3 failing, 45 passing"}
      ],
      "markdown": true
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View in Bitbucket",
      "targets": [
        {"os": "default", "uri": "https://bitbucket.org/myorg/frontend/addon/pipelines/home#!/results/123"}
      ]
    }
  ]
}
```

### Push Event

```json
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "themeColor": "#6264A7",
  "summary": "my-repo/api: Push to main",
  "sections": [
    {
      "activityTitle": "Push to main",
      "activitySubtitle": "by Jane Developer",
      "facts": [
        {"name": "Repository", "value": "my-repo/api"},
        {"name": "Branch", "value": "main"},
        {"name": "Pusher", "value": "Jane Developer"},
        {"name": "Commits", "value": "2"},
        {"name": "Recent Commits", "value": "e5f6g7h8: Fix authentication bug\ni9j0k1l2: Update API documentation"}
      ],
      "markdown": true
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View in Bitbucket",
      "targets": [
        {"os": "default", "uri": "https://bitbucket.org/myorg/api/commits/e5f6g7h8"}
      ]
    }
  ]
}
```

## Webhook Payload Examples

### Bitbucket Pull Request Created Event

```json
{
  "pullrequest": {
    "id": 42,
    "title": "Add user authentication API",
    "description": "Implements JWT-based authentication with refresh tokens",
    "state": "OPEN",
    "author": {
      "display_name": "John Developer",
      "username": "john.dev"
    },
    "source": {
      "branch": {"name": "feature/auth-api"}
    },
    "destination": {
      "branch": {"name": "main"}
    },
    "links": {
      "html": {"href": "https://bitbucket.org/myorg/backend/pull-requests/42"}
    }
  },
  "repository": {
    "full_name": "my-repo/backend",
    "name": "backend"
  }
}
```

### Bitbucket Push Event

```json
{
  "push": {
    "changes": [
      {
        "new": {"name": "main"},
        "commits": [
          {
            "hash": "e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4",
            "message": "Fix authentication bug\n\nResolves issue with token expiration",
            "author": {
              "user": {
                "display_name": "Jane Developer"
              }
            },
            "links": {
              "html": {"href": "https://bitbucket.org/myorg/api/commits/e5f6g7h8"}
            }
          }
        ]
      }
    ]
  },
  "repository": {
    "full_name": "my-repo/api",
    "name": "api"
  },
  "actor": {
    "display_name": "Jane Developer",
    "username": "jane.dev"
  }
}
```

### Bitbucket Build Status Event

```json
{
  "commit_status": {
    "name": "CI Pipeline",
    "description": "Tests failed: 3 failing, 45 passing",
    "state": "FAILED",
    "url": "https://bitbucket.org/myorg/frontend/addon/pipelines/home#!/results/123",
    "commit": {
      "hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
    }
  },
  "repository": {
    "full_name": "my-repo/frontend",
    "name": "frontend"
  }
}
```

## Testing Examples

### Manual Webhook Testing

#### Test with curl

```bash
# Set variables
WEBHOOK_URL="https://abc123.execute-api.us-east-1.amazonaws.com/prod/webhook"
SECRET="your-webhook-secret"
PAYLOAD='{"repository":{"full_name":"test/repo"},"pullrequest":{"id":1,"title":"Test PR","author":{"display_name":"Test User"},"source":{"branch":{"name":"feature"}},"destination":{"branch":{"name":"main"}},"links":{"html":{"href":"https://bitbucket.org/test/repo/pull-requests/1"}}}}'

# Generate signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send test webhook
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Event-Key: pullrequest:created" \
  -H "X-Hub-Signature: sha256=$SIGNATURE" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL"
```

#### Test with Python

```python
import json
import hmac
import hashlib
import requests

# Configuration
webhook_url = "https://abc123.execute-api.us-east-1.amazonaws.com/prod/webhook"
secret = "your-webhook-secret"

# Test payload
payload = {
    "repository": {"full_name": "test/repo"},
    "pullrequest": {
        "id": 1,
        "title": "Test PR",
        "author": {"display_name": "Test User"},
        "source": {"branch": {"name": "feature"}},
        "destination": {"branch": {"name": "main"}},
        "links": {"html": {"href": "https://bitbucket.org/test/repo/pull-requests/1"}}
    }
}

# Generate signature
payload_json = json.dumps(payload)
signature = hmac.new(
    secret.encode('utf-8'),
    payload_json.encode('utf-8'),
    hashlib.sha256
).hexdigest()

# Send request
headers = {
    "Content-Type": "application/json",
    "X-Event-Key": "pullrequest:created",
    "X-Hub-Signature": f"sha256={signature}"
}

response = requests.post(webhook_url, json=payload, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
```

### Integration Testing

#### Test Event Filtering

```bash
# Test that filtered events are ignored
PAYLOAD='{"repository":{"full_name":"test/repo"},"comment":{"content":{"raw":"Test comment"},"user":{"display_name":"Test User"}}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Event-Key: pullrequest:comment_created" \
  -H "X-Hub-Signature: sha256=$SIGNATURE" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL"

# Should return 200 but not post to Teams if comments are filtered out
```

#### Test Signature Verification

```bash
# Test invalid signature (should return 401)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Event-Key: pullrequest:created" \
  -H "X-Hub-Signature: sha256=invalid-signature" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL"
```

## Multi-Repository Setup

### Scenario: Multiple Repositories, Single Teams Channel

**Use Case**: Organization wants all repository notifications in one Teams channel.

**Setup**:
1. Deploy webhook integration once
2. Configure webhook in each repository with same URL and secret
3. Use repository name in Teams messages to distinguish sources

**Configuration**:
```hcl
# Single deployment handles multiple repositories
teams_webhook_url = "https://yourorg.webhook.office.com/webhookb2/central/notifications"
filter_mode = "all"
event_filter = "pullrequest:created,pullrequest:fulfilled,repo:push,repo:commit_status_updated"
```

### Scenario: Repository-Specific Teams Channels

**Use Case**: Different teams want notifications in their own channels.

**Setup Options**:

#### Option 1: Multiple Deployments
```bash
# Deploy separate instances
terraform workspace new frontend-team
terraform apply -var-file="frontend.tfvars"

terraform workspace new backend-team  
terraform apply -var-file="backend.tfvars"
```

#### Option 2: Custom Routing (Advanced)
Modify Lambda function to route based on repository:

```python
def get_teams_url_for_repository(repository_name):
    """Route to different Teams channels based on repository"""
    routing_config = {
        'frontend-repo': 'FRONTEND_TEAMS_URL_SECRET_ARN',
        'backend-repo': 'BACKEND_TEAMS_URL_SECRET_ARN',
        'mobile-repo': 'MOBILE_TEAMS_URL_SECRET_ARN'
    }
    
    secret_arn = routing_config.get(repository_name, 'DEFAULT_TEAMS_URL_SECRET_ARN')
    return get_secret(secret_arn)
```

## Monitoring Examples

### CloudWatch Dashboard

Create a custom dashboard to monitor webhook activity:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["BitbucketTeamsWebhook/EventTypes", "EventType-pullrequest-created"],
          [".", "EventType-pullrequest-fulfilled"],
          [".", "EventType-repo-push"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Webhook Events by Type"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["BitbucketTeamsWebhook", "SignatureVerificationFailures"],
          [".", "TeamsAPIFailures"],
          [".", "UnsupportedEventTypes"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Error Metrics"
      }
    }
  ]
}
```

### Log Analysis Queries

#### Find Most Active Repositories
```sql
fields @timestamp, repository
| filter @message like /Successfully posted/
| stats count() as events by repository
| sort events desc
| limit 10
```

#### Analyze Processing Performance
```sql
fields @timestamp, processing_duration_ms, event_type
| filter @message like /processing_duration_ms/
| stats avg(processing_duration_ms) as avg_duration, max(processing_duration_ms) as max_duration by event_type
| sort avg_duration desc
```

#### Security Monitoring
```sql
fields @timestamp, @message
| filter level = "WARN" and @message like /signature/
| stats count() as failures by bin(5m)
```

## Troubleshooting Examples

### Common Issues and Solutions

#### Issue: Teams Messages Not Appearing

**Diagnosis**:
```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/bitbucket-teams-notifier --follow

# Look for specific patterns
aws logs filter-log-events \
  --log-group-name /aws/lambda/bitbucket-teams-notifier \
  --filter-pattern "Teams API" \
  --start-time $(date -d '1 hour ago' +%s)000
```

**Common Causes**:
1. **Event Filtered**: Look for "Event filtered out" messages
2. **Teams API Failure**: Look for HTTP error codes from Teams
3. **Invalid Teams URL**: Test URL manually with curl

#### Issue: High Signature Verification Failures

**Diagnosis**:
```bash
# Check signature failure rate
aws logs filter-log-events \
  --log-group-name /aws/lambda/bitbucket-teams-notifier \
  --filter-pattern "signature.*failed" \
  --start-time $(date -d '1 hour ago' +%s)000
```

**Solutions**:
1. Verify webhook secret matches in both Bitbucket and Terraform
2. Check for webhook URL typos
3. Ensure webhook is configured with correct secret

#### Issue: Lambda Timeouts

**Diagnosis**:
```bash
# Check for timeout errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/bitbucket-teams-notifier \
  --filter-pattern "Task timed out" \
  --start-time $(date -d '1 hour ago' +%s)000
```

**Solutions**:
1. Increase `lambda_timeout` in terraform.tfvars
2. Increase `lambda_memory_size` for better performance
3. Check Teams API response times

## Performance Examples

### High-Volume Configuration

For repositories with high webhook volume (>1000/day):

```hcl
# Optimized for high volume
lambda_memory_size = 512  # More memory for faster execution
lambda_timeout     = 60   # Longer timeout for reliability

# Enable provisioned concurrency to avoid cold starts
provisioned_concurrency_config = {
  provisioned_concurrent_executions = 10
}

# Shorter log retention to manage costs
log_retention_days = 7

# More sensitive monitoring
lambda_error_threshold      = 10
lambda_duration_threshold   = 30000  # 30 seconds
teams_api_failure_threshold = 10
```

### Cost-Optimized Configuration

For low-volume repositories (<100 webhooks/day):

```hcl
# Minimal configuration for cost optimization
lambda_memory_size = 128  # Minimum memory
lambda_timeout     = 30   # Standard timeout

# Minimal log retention
log_retention_days = 3

# Less sensitive monitoring
lambda_error_threshold      = 5
teams_api_failure_threshold = 5
enable_monitoring_alarms    = false  # Disable if not needed
```

## Advanced Use Cases

### Custom Message Formatting

Modify the Lambda function to customize Teams message appearance:

```python
def format_custom_teams_message(parsed_event):
    """Custom message formatting with company branding"""
    
    # Custom color scheme
    color_map = {
        'pull_request': '#FF6B35',  # Company orange
        'push': '#004E89',          # Company blue
        'commit_status': '#1A936F'  # Company green
    }
    
    # Add company logo and custom fields
    message_card = TeamsMessageCard(
        theme_color=color_map.get(parsed_event.event_category, '#6C757D'),
        summary=f"🚀 {parsed_event.repository}: {parsed_event.title}"
    )
    
    # Add custom facts
    section = MessageSection(
        activity_title=f"🔔 {parsed_event.title}",
        activity_subtitle=f"👤 {parsed_event.author} • 📅 {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    )
    
    return message_card.to_dict()
```

### Integration with External Systems

Extend the webhook to integrate with other systems:

```python
def post_to_multiple_systems(parsed_event, teams_message):
    """Post to Teams and other systems"""
    
    # Post to Teams
    teams_success = post_to_teams(teams_message, teams_url)
    
    # Post to Slack (if configured)
    if os.environ.get('SLACK_WEBHOOK_URL'):
        slack_message = convert_to_slack_format(teams_message)
        post_to_slack(slack_message)
    
    # Update Jira (for PR events)
    if parsed_event.event_category == 'pull_request':
        update_jira_issue(parsed_event)
    
    # Send email for critical failures
    if parsed_event.action == 'failed':
        send_email_alert(parsed_event)
    
    return teams_success
```

This comprehensive examples document provides practical guidance for implementing and customizing the Bitbucket Teams Webhook integration across various scenarios and requirements.