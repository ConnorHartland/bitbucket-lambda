# Configuration Guide

This document provides comprehensive configuration guidance for the Bitbucket Teams Webhook integration.

## Environment Variables

The Lambda function is configured through environment variables that are automatically set by Terraform based on your `terraform.tfvars` configuration.

### Required Environment Variables

| Variable | Description | Source | Example |
|----------|-------------|--------|---------|
| `TEAMS_WEBHOOK_URL_SECRET_ARN` | ARN of the secret containing the Teams webhook URL | Terraform (from `teams_webhook_url`) | `arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-teams/teams-url-AbCdEf` |
| `BITBUCKET_SECRET_ARN` | ARN of the secret containing the Bitbucket webhook signature secret | Terraform (from `bitbucket_webhook_secret`) | `arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-teams/webhook-secret-XyZ123` |

### Optional Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `EVENT_FILTER` | Comma-separated list of Bitbucket event types to process | `""` (empty - process all) | `pullrequest:created,repo:push,repo:commit_status_updated` |
| `FILTER_MODE` | Event filtering mode | `all` | `all`, `deployments`, `failures` |

## Terraform Configuration

### Required Variables

Configure these in your `terraform.tfvars` file:

```hcl
# AWS Configuration
aws_region   = "us-east-1"  # AWS region for deployment
environment  = "prod"       # Environment name (used in resource naming)

# Integration Configuration
teams_webhook_url        = "https://your-org.webhook.office.com/webhookb2/..."
bitbucket_webhook_secret = "your-random-secret-string-here"
```

### Event Filtering Configuration

```hcl
# Event Filter Configuration
event_filter = "pullrequest:created,pullrequest:fulfilled,pullrequest:rejected,repo:push,pullrequest:comment_created,repo:commit_status_updated"
filter_mode  = "all"  # Options: "all", "deployments", "failures"
```

#### Filter Mode Options

##### `all` Mode (Default)
Processes all event types specified in `event_filter`. If `event_filter` is empty, processes all supported events.

**Use case**: Teams want notifications for all repository activity.

**Example**:
```hcl
filter_mode  = "all"
event_filter = "pullrequest:created,pullrequest:fulfilled,repo:push"
```

##### `deployments` Mode
Only processes deployment and build-related events, regardless of `event_filter` setting.

**Processed events**:
- `repo:commit_status_updated` - Build/pipeline status changes
- `repo:commit_status_created` - New build/pipeline started
- `pullrequest:approved` - PR approved (deployment gate)
- `pullrequest:unapproved` - PR approval removed

**Use case**: DevOps teams focused on deployment pipeline status.

**Example**:
```hcl
filter_mode = "deployments"
# event_filter is ignored in this mode
```

##### `failures` Mode
Only processes events that represent failures or issues.

**Processed events**:
- Failed builds (`repo:commit_status_updated` with `state = FAILED`)
- Stopped builds (`repo:commit_status_updated` with `state = STOPPED`)
- Declined pull requests (`pullrequest:rejected`)

**Use case**: Teams that only want to be notified of problems.

**Example**:
```hcl
filter_mode = "failures"
# event_filter is ignored in this mode
```

### Lambda Configuration

```hcl
# Lambda Function Configuration
lambda_timeout     = 30   # Timeout in seconds (max 900)
lambda_memory_size = 256  # Memory in MB (128-10240)
```

**Memory Sizing Guidelines**:
- **128 MB**: Sufficient for most workloads (< 1000 webhooks/day)
- **256 MB**: Better performance for high-frequency webhooks
- **512 MB+**: Only needed for very high volume or complex processing

### Logging Configuration

```hcl
# CloudWatch Logs Configuration
log_retention_days = 7  # Options: 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
```

**Retention Guidelines**:
- **1-7 days**: Development/testing environments
- **14-30 days**: Production environments with external log aggregation
- **90+ days**: Compliance requirements or detailed troubleshooting needs

### API Gateway Configuration

```hcl
# API Gateway Configuration
api_stage_name = "prod"  # Stage name for the API Gateway deployment
```

### Secret Management Configuration

```hcl
# Secrets Manager Configuration
secret_recovery_window_days = 7     # Days before permanent deletion (7-30)
enable_secret_rotation      = false # Enable automatic rotation
rotation_days              = 90     # Rotation interval if enabled
```

**Secret Rotation**:
- **Disabled (default)**: Manual rotation when needed
- **Enabled**: Automatic rotation every `rotation_days`
- **Recovery Window**: Grace period for secret recovery after deletion

### Monitoring Configuration

```hcl
# Monitoring and Alerting
enable_monitoring_alarms = true
alarm_email_endpoints    = [
  "devops@yourcompany.com",
  "alerts@yourcompany.com"
]

# Alarm Thresholds (optional - defaults provided)
lambda_error_threshold         = 5      # Number of errors in 5 minutes
lambda_error_rate_threshold    = 0.05   # 5% error rate
lambda_duration_threshold      = 25000  # 25 seconds (near timeout)
signature_failure_threshold    = 10     # Per hour
teams_api_failure_threshold    = 5      # Number of failures in 5 minutes
api_gateway_4xx_threshold      = 10     # Number of 4XX errors in 5 minutes
unsupported_events_threshold   = 50     # Per hour
```

## Bitbucket Webhook Configuration

### Webhook Setup

1. **Navigate to Repository Settings**:
   - Go to your Bitbucket repository
   - Click **Settings** → **Webhooks**

2. **Create New Webhook**:
   - Click **Add webhook**
   - **Title**: `Teams Notifications` (or descriptive name)
   - **URL**: Use the `webhook_url` from Terraform output
   - **Secret**: Use the same value as `bitbucket_webhook_secret` in terraform.tfvars

3. **Configure Triggers**:
   Select the events you want to monitor based on your `event_filter` configuration.

### Event Trigger Configuration

#### For `all` Mode
Select events matching your `event_filter`:

**Pull Request Events**:
- ☑️ Created
- ☑️ Updated  
- ☑️ Merged
- ☑️ Declined
- ☑️ Comment created

**Repository Events**:
- ☑️ Push
- ☑️ Commit status created
- ☑️ Commit status updated

#### For `deployments` Mode
Select deployment-related events:

**Repository Events**:
- ☑️ Commit status created
- ☑️ Commit status updated

**Pull Request Events**:
- ☑️ Approved
- ☑️ Approval removed

#### For `failures` Mode
Select all events that could represent failures:

**Repository Events**:
- ☑️ Commit status updated

**Pull Request Events**:
- ☑️ Declined

### Webhook Testing

After configuration, test the webhook:

1. **Trigger a Test Event**:
   - Create a test pull request, or
   - Push a commit to trigger a build

2. **Verify in Bitbucket**:
   - Go to **Settings** → **Webhooks**
   - Click on your webhook
   - Check **Recent deliveries** for successful responses (200 status)

3. **Check Teams Channel**:
   - Verify message appears in configured Teams channel
   - Check message formatting and links

4. **Review CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/bitbucket-teams-notifier --follow
   ```

## Environment-Specific Configuration

### Development Environment

```hcl
# terraform.tfvars for development
environment               = "dev"
teams_webhook_url         = "https://your-org.webhook.office.com/webhookb2/.../dev"
bitbucket_webhook_secret  = "dev-secret-123"
filter_mode              = "all"
lambda_timeout           = 30
lambda_memory_size       = 128
log_retention_days       = 3
enable_monitoring_alarms = false
```

### Staging Environment

```hcl
# terraform.tfvars for staging
environment               = "staging"
teams_webhook_url         = "https://your-org.webhook.office.com/webhookb2/.../staging"
bitbucket_webhook_secret  = "staging-secret-456"
filter_mode              = "deployments"
lambda_timeout           = 30
lambda_memory_size       = 256
log_retention_days       = 7
enable_monitoring_alarms = true
alarm_email_endpoints    = ["staging-alerts@yourcompany.com"]
```

### Production Environment

```hcl
# terraform.tfvars for production
environment               = "prod"
teams_webhook_url         = "https://your-org.webhook.office.com/webhookb2/.../prod"
bitbucket_webhook_secret  = "prod-secret-789"
filter_mode              = "failures"  # Only failures in prod
lambda_timeout           = 30
lambda_memory_size       = 256
log_retention_days       = 30
enable_monitoring_alarms = true
alarm_email_endpoints    = [
  "devops@yourcompany.com",
  "oncall@yourcompany.com"
]

# Stricter thresholds for production
lambda_error_threshold      = 3
lambda_error_rate_threshold = 0.02  # 2%
signature_failure_threshold = 5
```

## Multi-Environment Deployment

### Using Terraform Workspaces

```bash
# Create workspaces
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Deploy to specific environment
terraform workspace select dev
terraform apply -var-file="dev.tfvars"

terraform workspace select prod
terraform apply -var-file="prod.tfvars"
```

### Using Directory Structure

```
environments/
├── dev/
│   ├── terraform.tfvars
│   └── backend.tf
├── staging/
│   ├── terraform.tfvars
│   └── backend.tf
└── prod/
    ├── terraform.tfvars
    └── backend.tf
```

## Configuration Validation

### Pre-Deployment Validation

```bash
# Validate Terraform configuration
terraform fmt -check
terraform validate

# Check for common issues
tflint

# Validate webhook secret strength
python3 -c "
import secrets
secret = 'your-webhook-secret'
if len(secret) < 32:
    print('WARNING: Webhook secret should be at least 32 characters')
if secret.isalnum():
    print('WARNING: Consider using special characters in webhook secret')
"
```

### Post-Deployment Validation

```bash
# Test webhook endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Event-Key: repo:push" \
  -H "X-Hub-Signature: sha256=$(echo -n '{}' | openssl dgst -sha256 -hmac 'your-secret')" \
  -d '{}' \
  "$(terraform output -raw webhook_url)"

# Check Lambda function configuration
aws lambda get-function-configuration \
  --function-name "$(terraform output -raw lambda_function_name)"

# Verify secrets are accessible
aws secretsmanager get-secret-value \
  --secret-id "$(terraform output -raw teams_url_secret_arn)" \
  --query 'SecretString' --output text

aws secretsmanager get-secret-value \
  --secret-id "$(terraform output -raw webhook_secret_arn)" \
  --query 'SecretString' --output text
```

## Troubleshooting Configuration Issues

### Common Configuration Problems

#### 1. Invalid Teams Webhook URL

**Symptoms**:
- Teams API failures in CloudWatch logs
- HTTP 400/404 responses from Teams

**Solutions**:
- Verify URL format: `https://*.webhook.office.com/webhookb2/...`
- Test URL manually with curl
- Regenerate webhook in Teams if needed

#### 2. Webhook Secret Mismatch

**Symptoms**:
- Signature verification failures
- HTTP 401 responses
- "Invalid signature" in logs

**Solutions**:
- Ensure Bitbucket webhook secret matches Terraform variable
- Check for extra whitespace or special characters
- Regenerate secret and update both sides

#### 3. Event Filter Misconfiguration

**Symptoms**:
- No Teams messages despite webhook triggers
- "Event filtered out" in logs

**Solutions**:
- Verify `event_filter` matches Bitbucket webhook triggers
- Check `filter_mode` setting
- Review CloudWatch logs for filtering decisions

#### 4. Permission Issues

**Symptoms**:
- "Access denied" errors in logs
- Secrets Manager failures

**Solutions**:
- Verify IAM role has required permissions
- Check secret ARNs are correct
- Ensure Lambda execution role is attached

### Configuration Best Practices

1. **Use Strong Secrets**: Generate webhook secrets with sufficient entropy
2. **Environment Separation**: Use different secrets and URLs per environment
3. **Least Privilege**: Configure minimal required permissions
4. **Monitor Configuration**: Set up alarms for configuration-related failures
5. **Document Changes**: Track configuration changes in version control
6. **Test Thoroughly**: Validate configuration in non-production environments first

## Advanced Configuration

### Custom Event Processing

For advanced use cases, you can modify the Lambda function to:

1. **Route to Multiple Teams Channels**: Based on repository or event type
2. **Custom Message Formatting**: Modify message templates
3. **Additional Integrations**: Send to Slack, email, or other services
4. **Event Enrichment**: Add additional context from external APIs

### Performance Tuning

```hcl
# High-volume configuration
lambda_memory_size = 512
lambda_timeout     = 60

# Enable provisioned concurrency for consistent performance
provisioned_concurrency_config = {
  provisioned_concurrent_executions = 5
}
```

### Security Hardening

```hcl
# Enhanced security configuration
enable_secret_rotation = true
rotation_days         = 30

# VPC configuration for network isolation
vpc_config = {
  subnet_ids         = ["subnet-12345", "subnet-67890"]
  security_group_ids = ["sg-abcdef"]
}

# Enhanced monitoring
enable_xray_tracing = true
```