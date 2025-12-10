# Bitbucket Teams Webhook Integration

A secure, serverless webhook integration that receives events from Bitbucket and posts formatted notifications to Microsoft Teams channels. Built with AWS Lambda, API Gateway, and Terraform for infrastructure as code.

## Features

- **Secure Webhook Processing**: HMAC-SHA256 signature verification for authentic requests
- **Event Filtering**: Configurable filtering by event type, deployment events, or failure events only
- **Rich Message Formatting**: Detailed Teams message cards with clickable links and event context
- **Comprehensive Monitoring**: CloudWatch metrics, alarms, and structured logging
- **Infrastructure as Code**: Complete Terraform configuration for reproducible deployments
- **Automated CI/CD**: Bitbucket Pipelines for validation, testing, and deployment

## Supported Events

| Event Type | Description | Teams Color |
|------------|-------------|-------------|
| Pull Request Created | New PR opened | Blue |
| Pull Request Merged | PR successfully merged | Green |
| Pull Request Declined | PR rejected/declined | Red |
| Push Events | Code pushed to repository | Purple |
| Comments | Comments on PRs or commits | Gray |
| Build Success | Pipeline/build succeeded | Green |
| Build Failure | Pipeline/build failed | Red |

## Quick Start

### 1. Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0 installed
- Microsoft Teams channel with webhook permissions

### 2. Get Teams Webhook URL

1. In Microsoft Teams, navigate to your target channel
2. Click the three dots (⋯) → **Connectors**
3. Find **Incoming Webhook** and click **Configure**
4. Provide a name and upload an icon (optional)
5. Copy the webhook URL that's generated

### 3. Configure and Deploy

```bash
# Clone the repository
git clone <repository-url>
cd bitbucket-teams-webhook

# Copy and edit configuration
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values (see Configuration section)

# Initialize and deploy
terraform init
terraform plan
terraform apply
```

### 4. Configure Bitbucket Webhook

1. Go to your Bitbucket repository → **Settings** → **Webhooks**
2. Click **Add webhook**
3. **Title**: `Teams Notifications`
4. **URL**: Use the `webhook_url` from Terraform output
5. **Secret**: Use the same value as `bitbucket_webhook_secret` in your terraform.tfvars
6. **Triggers**: Select the events you want to monitor (see Event Configuration)
7. **Save**

## Configuration

### Environment Variables

The Lambda function uses the following environment variables (automatically configured by Terraform):

| Variable | Description | Example |
|----------|-------------|---------|
| `TEAMS_WEBHOOK_URL_SECRET_ARN` | ARN of secret containing Teams webhook URL | `arn:aws:secretsmanager:...` |
| `BITBUCKET_SECRET_ARN` | ARN of secret containing webhook signature secret | `arn:aws:secretsmanager:...` |
| `EVENT_FILTER` | Comma-separated list of event types to process | `pullrequest:created,repo:push` |
| `FILTER_MODE` | Filter mode: `all`, `deployments`, `failures` | `all` |

### Terraform Variables

Configure these in your `terraform.tfvars` file:

```hcl
# Required
aws_region                = "us-east-1"
environment               = "prod"
teams_webhook_url         = "https://your-org.webhook.office.com/webhookb2/..."
bitbucket_webhook_secret  = "your-random-secret-string-here"

# Event Filtering
event_filter = "pullrequest:created,pullrequest:fulfilled,pullrequest:rejected,repo:push"
filter_mode  = "all"  # Options: "all", "deployments", "failures"

# Optional - Lambda Configuration
lambda_timeout     = 30
lambda_memory_size = 256
log_retention_days = 7

# Optional - Monitoring
enable_monitoring_alarms = true
alarm_email_endpoints    = ["devops@yourcompany.com"]
```

### Event Filtering Modes

#### `all` Mode
Processes all configured event types in `event_filter`.

#### `deployments` Mode
Only processes deployment-related events:
- `repo:commit_status_updated`
- `repo:commit_status_created`
- `pullrequest:approved`
- `pullrequest:unapproved`

#### `failures` Mode
Only processes failure events:
- Failed pipeline builds (`commit_status.state = FAILED`)
- Declined pull requests (`pullrequest:rejected`)
- Stopped builds (`commit_status.state = STOPPED`)

### Bitbucket Event Types

Common event types you can include in `event_filter`:

```hcl
event_filter = "pullrequest:created,pullrequest:updated,pullrequest:fulfilled,pullrequest:rejected,pullrequest:comment_created,repo:push,repo:commit_status_updated"
```

| Event Type | Description |
|------------|-------------|
| `pullrequest:created` | New pull request opened |
| `pullrequest:updated` | Pull request updated |
| `pullrequest:fulfilled` | Pull request merged |
| `pullrequest:rejected` | Pull request declined |
| `pullrequest:approved` | Pull request approved |
| `pullrequest:comment_created` | Comment added to PR |
| `repo:push` | Code pushed to repository |
| `repo:commit_status_updated` | Build/pipeline status changed |
| `repo:commit_comment_created` | Comment added to commit |

## Architecture

```
Bitbucket → API Gateway → Lambda Function → Teams Channel
                ↓              ↓
         CloudWatch Logs  Secrets Manager
```

### Components

- **API Gateway**: HTTPS endpoint for webhook reception
- **Lambda Function**: Event processing, filtering, and Teams posting
- **Secrets Manager**: Secure storage for Teams URL and webhook secret
- **CloudWatch**: Logging, metrics, and monitoring
- **IAM Roles**: Least-privilege access control

## Monitoring and Troubleshooting

### CloudWatch Metrics

The system emits custom metrics for monitoring:

- `EventType-*`: Count of each event type processed
- `SignatureVerificationFailures`: Invalid webhook signatures
- `TeamsAPIFailures`: Failed Teams API calls
- `UnsupportedEventTypes`: Events not supported
- `ProcessingDuration`: End-to-end processing time

### CloudWatch Alarms

Automatic alarms are created for:

- Lambda errors (> 5 errors in 5 minutes)
- Lambda error rate (> 5%)
- Teams API failures (> 5 failures in 5 minutes)
- Signature verification failures (> 10 per hour)

### Common Issues

#### Webhook Not Triggering

1. **Check Bitbucket webhook configuration**:
   - Verify URL matches Terraform output
   - Ensure secret matches `bitbucket_webhook_secret`
   - Check selected event triggers

2. **Check CloudWatch logs**:
   ```bash
   aws logs tail /aws/lambda/bitbucket-teams-notifier --follow
   ```

#### Signature Verification Failures

1. **Verify webhook secret**:
   - Ensure Bitbucket webhook secret matches Terraform variable
   - Check AWS Secrets Manager for correct value

2. **Check request format**:
   - Bitbucket sends `X-Hub-Signature` header
   - Format should be `sha256=<hex_digest>`

#### Teams Messages Not Appearing

1. **Verify Teams webhook URL**:
   - Test URL manually with curl
   - Check Teams channel permissions

2. **Check event filtering**:
   - Verify `filter_mode` and `event_filter` settings
   - Check CloudWatch logs for "Event filtered out" messages

#### High Processing Duration

1. **Check Secrets Manager performance**:
   - Secrets are cached after first retrieval
   - Cold starts may take longer

2. **Monitor Teams API response times**:
   - Teams API calls have 10-second timeout
   - Network issues may cause delays

### Log Analysis

Use CloudWatch Logs Insights for detailed analysis:

```sql
# Find all signature verification failures
fields @timestamp, event_type, request_id
| filter @message like /signature.*failed/
| sort @timestamp desc

# Analyze processing duration by event type
fields @timestamp, event_type, processing_duration_ms
| filter @message like /Successfully posted/
| stats avg(processing_duration_ms) by event_type

# Find Teams API failures
fields @timestamp, event_type, repository
| filter level = "ERROR" and @message like /Teams/
| sort @timestamp desc
```

## Security

### Webhook Security

- **Signature Verification**: All requests verified using HMAC-SHA256
- **Constant-Time Comparison**: Prevents timing attacks
- **Secret Management**: Webhook secrets stored in AWS Secrets Manager
- **HTTPS Only**: All communication encrypted in transit

### AWS Security

- **IAM Least Privilege**: Lambda role has minimal required permissions
- **Secret Rotation**: Supports automatic secret rotation
- **VPC Optional**: Can be deployed in VPC for additional network isolation
- **CloudTrail Integration**: All AWS API calls logged

### Log Security

- **Sensitive Data Redaction**: Webhook signatures and secrets automatically redacted
- **Structured Logging**: Consistent log format for security monitoring
- **Request Correlation**: Request IDs for tracking without exposing sensitive data

## Development

### Local Testing

```bash
# Install dependencies
pip install -r requirements-test.txt

# Run tests
pytest tests/ -v --cov=lambda

# Run property-based tests
pytest tests/ -k "property" -v

# Validate Terraform
terraform fmt -check
terraform validate
tflint
```

### Adding New Event Types

1. **Update event parsing** in `lambda/lambda_function.py`:
   ```python
   def parse_bitbucket_event(body, event_type):
       # Add new event type handling
   ```

2. **Update message formatting**:
   ```python
   def format_teams_message(parsed_event):
       # Add formatting for new event category
   ```

3. **Add tests** in `tests/`:
   - Unit tests for parsing logic
   - Property tests for message formatting
   - Integration tests for end-to-end flow

4. **Update documentation** with new event type details

### Deployment Pipeline

The project includes automated CI/CD via Bitbucket Pipelines:

1. **Validation**: Terraform syntax and formatting
2. **Testing**: Unit and property-based tests with coverage
3. **Planning**: Terraform plan generation and review
4. **Deployment**: Infrastructure and Lambda code deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed pipeline documentation.

## Cost Optimization

### AWS Costs

Typical monthly costs for moderate usage (1000 webhooks/month):

- **Lambda**: ~$0.20 (128MB, 500ms average)
- **API Gateway**: ~$3.50 (HTTP API pricing)
- **Secrets Manager**: ~$0.80 (2 secrets)
- **CloudWatch**: ~$1.00 (logs and metrics)
- **Total**: ~$5.50/month

### Optimization Tips

- **Right-size Lambda memory**: Start with 128MB, monitor duration
- **Optimize log retention**: Reduce from 7 days if not needed
- **Use event filtering**: Reduce unnecessary processing
- **Monitor cold starts**: Consider provisioned concurrency for high-frequency use

## Support

### Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - CI/CD pipeline and deployment
- [Monitoring Guide](docs/MONITORING.md) - CloudWatch setup and troubleshooting
- [Security Guide](SECURITY.md) - Security considerations and best practices

### Getting Help

1. **Check CloudWatch logs** for error details
2. **Review configuration** against this documentation
3. **Test webhook manually** using curl or Postman
4. **Check AWS service status** for regional issues

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
