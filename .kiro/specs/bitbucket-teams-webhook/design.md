# Design Document

## Overview

This design describes a secure, serverless webhook integration system that receives events from Bitbucket, transforms them into Microsoft Teams message cards, and posts them to Teams channels. The system uses AWS Lambda for event processing, API Gateway for HTTP endpoint exposure, and Terraform for infrastructure management. Security is enforced through webhook signature verification using HMAC-SHA256, with secrets managed via AWS Secrets Manager.

The architecture follows a single-responsibility pattern where the Lambda function handles webhook validation, event parsing, message formatting, and Teams API interaction. Infrastructure is fully defined as code using Terraform, with automated deployment pipelines ensuring consistent and reproducible deployments.

## Architecture

### High-Level Architecture

```
Bitbucket → API Gateway → Lambda Function → Teams Workflow URL
                ↓              ↓
         CloudWatch Logs  Secrets Manager
```

### Component Flow

1. **Bitbucket** sends webhook events via HTTPS POST with signature header
2. **API Gateway** receives the request and invokes Lambda via proxy integration
3. **Lambda Function** performs:
   - Signature verification using shared secret from Secrets Manager
   - Event payload parsing and validation
   - Event type filtering based on configuration
   - Message card formatting based on event type
   - HTTP POST to Teams Workflow URL
4. **CloudWatch Logs** captures all execution logs for monitoring and debugging
5. **Secrets Manager** stores sensitive configuration (webhook secret, Teams URL)

### Security Layers

1. **Transport Security**: HTTPS-only communication enforced by API Gateway
2. **Signature Verification**: HMAC-SHA256 validation of webhook authenticity
3. **Secret Management**: AWS Secrets Manager for sensitive values
4. **IAM Least Privilege**: Lambda execution role with minimal required permissions
5. **Logging Controls**: Sensitive data excluded from CloudWatch logs

## Components and Interfaces

### 1. API Gateway HTTP API

**Purpose**: Expose a public HTTPS endpoint for Bitbucket webhooks

**Configuration**:
- Protocol: HTTP API (lower cost, simpler than REST API)
- Route: `POST /webhook`
- Integration: AWS_PROXY to Lambda function
- Stage: `prod` with auto-deploy enabled

**Interface**:
- Input: HTTP POST request from Bitbucket
- Output: Proxied to Lambda, returns Lambda response to caller

### 2. Lambda Function (Webhook Handler)

**Purpose**: Process webhook events and post to Teams

**Runtime**: Python 3.11

**Handler**: `lambda_function.lambda_handler`

**Timeout**: 30 seconds

**Memory**: 128 MB (default, sufficient for webhook processing)

**Environment Variables**:
- `TEAMS_WEBHOOK_URL_SECRET_ARN`: ARN of secret containing Teams URL
- `BITBUCKET_SECRET_ARN`: ARN of secret containing webhook verification secret
- `EVENT_FILTER`: Comma-separated list of event types to process (e.g., "pullrequest:created,repo:push,repo:commit_status_updated")
- `FILTER_MODE`: Filter mode - "all" (process all), "deployments" (only pipeline events), "failures" (only failed events)

**Interface**:
```python
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """
    Args:
        event: API Gateway proxy event containing:
            - body: JSON string of webhook payload
            - headers: HTTP headers including X-Hub-Signature
            - requestContext: Request metadata
        context: Lambda execution context
    
    Returns:
        dict: API Gateway proxy response with statusCode and body
    """
```

**Modules**:

1. **Signature Verification Module**
   ```python
   def verify_signature(payload: str, signature: str, secret: str) -> bool:
       """Verify HMAC-SHA256 signature using constant-time comparison"""
   ```

2. **Event Parser Module**
   ```python
   def parse_bitbucket_event(body: dict, event_type: str) -> Optional[ParsedEvent]:
       """Extract relevant fields based on event type"""
   ```

3. **Message Formatter Module**
   ```python
   def format_teams_message(parsed_event: ParsedEvent) -> dict:
       """Create Teams MessageCard or Adaptive Card JSON"""
   ```

4. **Teams Poster Module**
   ```python
   def post_to_teams(message: dict, webhook_url: str) -> bool:
       """POST message to Teams, return success status"""
   ```

5. **Secrets Retrieval Module**
   ```python
   def get_secret(secret_arn: str) -> str:
       """Retrieve secret from AWS Secrets Manager with caching"""
   ```

6. **Event Filter Module**
   ```python
   def should_process_event(event_type: str, event_data: dict, filter_config: FilterConfig) -> bool:
       """Determine if event should be processed based on filter configuration"""
   ```

### 3. AWS Secrets Manager

**Purpose**: Securely store sensitive configuration

**Secrets**:
1. `bitbucket-teams/webhook-secret`: Bitbucket webhook signing secret
2. `bitbucket-teams/teams-url`: Microsoft Teams Workflow URL

**Access Pattern**: Lambda retrieves secrets on cold start and caches for warm invocations

### 4. IAM Role and Policies

**Lambda Execution Role Permissions**:
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` (CloudWatch)
- `secretsmanager:GetSecretValue` (Secrets Manager, scoped to specific secrets)

**Policy Structure**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": [
        "arn:aws:secretsmanager:REGION:ACCOUNT:secret:bitbucket-teams/*"
      ]
    }
  ]
}
```

### 5. CloudWatch Log Group

**Purpose**: Centralized logging for debugging and monitoring

**Configuration**:
- Log Group: `/aws/lambda/bitbucket-teams-notifier`
- Retention: 7 days (configurable via Terraform variable)

## Data Models

### Bitbucket Webhook Event

```python
@dataclass
class BitbucketEvent:
    event_type: str  # From X-Event-Key header
    signature: str   # From X-Hub-Signature header
    payload: dict    # Parsed JSON body
```

### Parsed Event (Internal Representation)

```python
@dataclass
class ParsedEvent:
    event_category: str  # 'pull_request', 'push', 'comment', etc.
    repository: str
    action: str
    author: str
    title: Optional[str]
    description: Optional[str]
    url: str
    metadata: dict  # Event-specific fields
```

### Teams Message Card

```python
@dataclass
class TeamsMessageCard:
    type: str = "MessageCard"
    context: str = "https://schema.org/extensions"
    theme_color: str  # Hex color based on event type
    summary: str
    sections: List[MessageSection]
    potential_actions: List[Action]

@dataclass
class MessageSection:
    activity_title: str
    activity_subtitle: Optional[str]
    facts: List[Fact]
    markdown: bool = True

@dataclass
class Fact:
    name: str
    value: str

@dataclass
class Action:
    type: str = "OpenUri"
    name: str
    targets: List[dict]  # [{"os": "default", "uri": "..."}]
```

### API Gateway Proxy Response

```python
@dataclass
class ProxyResponse:
    statusCode: int
    body: str
    headers: Optional[dict] = None

### Filter Configuration

```python
@dataclass
class FilterConfig:
    mode: str  # "all", "deployments", "failures"
    event_types: List[str]  # Explicit event types to include
    
    def should_process(self, event_type: str, event_data: dict) -> bool:
        """Determine if event should be processed"""
        if self.mode == "all":
            return True
        elif self.mode == "deployments":
            return "commit_status" in event_type or "pipeline" in event_type
        elif self.mode == "failures":
            return self._is_failure_event(event_type, event_data)
        else:
            return event_type in self.event_types
    
    def _is_failure_event(self, event_type: str, event_data: dict) -> bool:
        """Check if event represents a failure"""
        # Pipeline failures
        if "commit_status" in event_type:
            return event_data.get("commit_status", {}).get("state") in ["FAILED", "STOPPED"]
        # PR declined
        if event_type == "pullrequest:rejected":
            return True
        return False
```
```

## Data Models

### Event Type Mapping

| Bitbucket Event | X-Event-Key Header | Teams Color | Priority |
|----------------|-------------------|-------------|----------|
| Pull Request Created | `pullrequest:created` | Blue (#0078D4) | Medium |
| Pull Request Merged | `pullrequest:fulfilled` | Green (#28A745) | Low |
| Pull Request Declined | `pullrequest:rejected` | Red (#DC3545) | Medium |
| Push | `repo:push` | Purple (#6264A7) | Low |
| Comment Added | `pullrequest:comment_created` | Gray (#6C757D) | Low |
| Build Failed | `repo:commit_status_updated` (state=FAILED) | Red (#DC3545) | High |



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties were identified as redundant or overlapping:

- Properties related to signature extraction (2.1) and computation (2.2) can be combined into a single comprehensive signature verification property
- Properties 8.1 and 8.2 (reading Teams URL and webhook secret) can be combined into a single configuration retrieval property
- Property 3.3 is redundant with signature verification properties 2.2 and 2.4

The following properties represent the minimal set of unique, non-redundant correctness guarantees:

### Core Processing Properties

**Property 1: Event parsing completeness**
*For any* valid Bitbucket webhook JSON payload, parsing should successfully extract all event-specific required fields without errors
**Validates: Requirements 1.2**

**Property 2: Message card validity**
*For any* parsed Bitbucket event, the formatted Teams message should be valid JSON conforming to MessageCard schema with all required fields (type, summary, sections)
**Validates: Requirements 1.3**

**Property 3: Teams posting correctness**
*For any* valid Teams message card, the HTTP POST request to Teams should include correct headers (Content-Type: application/json) and the message as the request body
**Validates: Requirements 1.4**

### Security Properties

**Property 4: Signature verification correctness**
*For any* request body and shared secret, the computed HMAC-SHA256 signature should match Bitbucket's signature format and successfully verify authentic requests
**Validates: Requirements 2.1, 2.2**

**Property 5: Invalid signature rejection**
*For any* webhook request with an incorrect or missing signature, the handler should return 401 status code and not process the event
**Validates: Requirements 2.4**

**Property 6: Authenticated request processing**
*For any* webhook request with a valid signature, event processing should proceed to message formatting and Teams posting
**Validates: Requirements 2.5**

**Property 7: Secure secret retrieval**
*For any* Lambda invocation, secrets should be retrieved from AWS Secrets Manager using the correct ARN and cached for subsequent warm invocations
**Validates: Requirements 3.5**

### Event-Specific Properties

**Property 8: Pull request message completeness**
*For any* pull request event (created, updated, merged, declined), the formatted message should contain PR title, author, source branch, target branch, and action
**Validates: Requirements 4.1**

**Property 9: Push event message completeness**
*For any* push event, the formatted message should contain repository name, branch name, commit count, and pusher username
**Validates: Requirements 4.2**

**Property 10: Comment event message completeness**
*For any* comment event, the formatted message should contain comment text, author, and the context (PR or commit) where the comment was made
**Validates: Requirements 4.3**

**Property 11: URL inclusion in messages**
*For any* formatted Teams message, at least one clickable URL linking to the relevant Bitbucket resource should be present in the potentialAction section
**Validates: Requirements 4.4**

**Property 12: Unsupported event handling**
*For any* webhook event with an unsupported or unrecognized event type, the handler should return 200 status code without posting to Teams
**Validates: Requirements 4.5**

### Error Handling Properties

**Property 13: Error logging with context**
*For any* error during processing, a log entry should be created containing the error message, event type, and AWS request ID
**Validates: Requirements 7.1**

**Property 14: Teams failure logging**
*For any* failed Teams API call, the handler should log the HTTP status code and error response body
**Validates: Requirements 7.3**

**Property 15: Exception status code mapping**
*For any* caught exception, the handler should return an appropriate HTTP status code (400 for client errors, 500 for server errors, 401 for auth failures)
**Validates: Requirements 7.4**

### Configuration Properties

**Property 16: Configuration retrieval on startup**
*For any* Lambda cold start, both Teams Workflow URL and Bitbucket webhook secret should be retrieved from their configured sources (environment variables or Secrets Manager)
**Validates: Requirements 8.1, 8.2**

**Property 17: Missing configuration failure**
*For any* Lambda invocation where required configuration (Teams URL or webhook secret) is missing, the handler should fail immediately with a clear error message before processing events
**Validates: Requirements 8.3**

**Property 18: Secret rotation support**
*For any* secret value update in Secrets Manager, subsequent Lambda invocations should retrieve and use the updated value without code deployment
**Validates: Requirements 8.5**

### Event Filtering Properties

**Property 19: Filter configuration loading**
*For any* Lambda cold start, the event filter configuration should be loaded from environment variables and parsed into a FilterConfig object
**Validates: Requirements 9.1**

**Property 20: Event filter matching**
*For any* webhook event and filter configuration, the handler should correctly determine whether the event type matches the filter criteria
**Validates: Requirements 9.2**

**Property 21: Filtered event rejection**
*For any* webhook event that does not match the configured filter, the handler should return 200 status code without posting to Teams or storing in DynamoDB
**Validates: Requirements 9.3**

**Property 22: Failure event identification**
*For any* webhook event in "failures" filter mode, the handler should correctly identify failure events (failed pipelines, declined PRs) and process only those
**Validates: Requirements 9.5**

## Error Handling

### Error Categories and Responses

| Error Category | HTTP Status | Action | Logging |
|---------------|-------------|--------|---------|
| Invalid JSON payload | 400 | Return error, don't process | Log payload size and parse error |
| Missing/invalid signature | 401 | Reject request | Log attempt without exposing secret |
| Unsupported event type | 200 | Accept but don't process | Log event type for monitoring |
| Missing configuration | 500 | Fail fast | Log missing config keys |
| Teams API failure | 500 | Return error to Bitbucket | Log status code and response |
| Secrets Manager failure | 500 | Fail fast | Log AWS error |
| Unexpected exception | 500 | Return generic error | Log full stack trace |

### Error Handling Strategy

1. **Fail Fast**: Configuration errors (missing secrets, invalid ARNs) should cause immediate failure on cold start
2. **Graceful Degradation**: Unsupported event types return success to avoid Bitbucket retry storms
3. **Retry Guidance**: 5xx errors signal Bitbucket to retry; 4xx errors indicate permanent failure
4. **Security-First**: Never expose secrets, signatures, or sensitive data in logs or responses
5. **Observability**: All errors include request ID for correlation with CloudWatch logs

### Retry Logic

- **Bitbucket Retry Behavior**: Bitbucket retries webhooks on 5xx responses with exponential backoff
- **Lambda Timeout**: 30-second timeout prevents long-running failures
- **Teams API Retry**: No automatic retry; rely on Bitbucket's retry mechanism
- **Idempotency**: Webhook processing is idempotent; duplicate events are safe

## Testing Strategy

### Dual Testing Approach

This project uses both unit testing and property-based testing to ensure comprehensive correctness:

- **Unit tests** verify specific examples, edge cases, and integration points
- **Property tests** verify universal properties that should hold across all inputs
- Together they provide complete coverage: unit tests catch concrete bugs, property tests verify general correctness

### Property-Based Testing

**Framework**: `hypothesis` for Python (https://hypothesis.readthedocs.io/)

**Configuration**:
- Minimum 100 iterations per property test to ensure statistical confidence
- Each property test must include a comment tag: `**Feature: bitbucket-teams-webhook, Property {number}: {property_text}**`
- Each correctness property from the design document must be implemented by exactly one property-based test

**Test Generators**:
- `bitbucket_event_strategy`: Generates valid Bitbucket webhook payloads for all supported event types
- `signature_strategy`: Generates valid and invalid HMAC-SHA256 signatures
- `teams_message_strategy`: Generates Teams MessageCard JSON structures
- `http_response_strategy`: Generates various HTTP response scenarios

**Property Test Examples**:
```python
@given(bitbucket_event=bitbucket_event_strategy())
@settings(max_examples=100)
def test_property_1_event_parsing_completeness(bitbucket_event):
    """Feature: bitbucket-teams-webhook, Property 1: Event parsing completeness"""
    parsed = parse_bitbucket_event(bitbucket_event)
    assert parsed is not None
    assert all(hasattr(parsed, field) for field in required_fields(bitbucket_event['type']))
```

### Unit Testing

**Framework**: `pytest` with `moto` for AWS mocking

**Test Categories**:

1. **Signature Verification Tests**
   - Valid signature acceptance
   - Invalid signature rejection
   - Missing signature handling
   - Constant-time comparison verification

2. **Event Parsing Tests**
   - Pull request events (created, merged, declined)
   - Push events with multiple commits
   - Comment events on PRs and commits
   - Malformed JSON handling

3. **Message Formatting Tests**
   - MessageCard structure validation
   - Color coding by event type
   - URL generation correctness
   - Fact field population

4. **Integration Tests**
   - End-to-end flow with mocked Teams endpoint
   - Secrets Manager integration with moto
   - CloudWatch logging verification
   - API Gateway proxy event handling

5. **Error Handling Tests**
   - Missing configuration detection
   - Teams API failure scenarios
   - Exception handling and status codes
   - Log sanitization (no secrets in logs)

### Test Data

**Fixtures** (in `tests/fixtures/`):
- `bitbucket_pr_created.json`: Sample PR creation event
- `bitbucket_push.json`: Sample push event with commits
- `bitbucket_comment.json`: Sample comment event
- `teams_success_response.json`: Teams API success response

### Continuous Testing

- All tests run on every commit via GitHub Actions / GitLab CI
- Property tests run with increased iterations (1000) in CI for deeper validation
- Integration tests run against localstack for AWS service mocking
- Test coverage target: 90% for Lambda function code

## Infrastructure Details

### Terraform Module Structure

```
.
├── main.tf              # Primary resources (Lambda, API Gateway, IAM)
├── secrets.tf           # Secrets Manager resources
├── monitoring.tf        # CloudWatch logs and alarms
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── versions.tf          # Provider version constraints
└── terraform.tfvars.example  # Example variable values
```

### Terraform Resources

**Core Resources**:
- `aws_lambda_function.bitbucket_notifier`: Lambda function
- `aws_iam_role.lambda_role`: Lambda execution role
- `aws_iam_role_policy.lambda_policy`: Inline policy for Secrets Manager access
- `aws_apigatewayv2_api.webhook_api`: HTTP API Gateway
- `aws_apigatewayv2_integration.lambda_integration`: Lambda integration
- `aws_apigatewayv2_route.webhook_route`: POST /webhook route
- `aws_lambda_permission.api_gateway`: Permission for API Gateway to invoke Lambda

**Secrets Management**:
- `aws_secretsmanager_secret.teams_url`: Secret for Teams Workflow URL
- `aws_secretsmanager_secret.webhook_secret`: Secret for Bitbucket signature verification
- `aws_secretsmanager_secret_version.teams_url_version`: Secret value for Teams URL
- `aws_secretsmanager_secret_version.webhook_secret_version`: Secret value for webhook secret

**Monitoring**:
- `aws_cloudwatch_log_group.lambda_logs`: Log group with retention policy
- `aws_cloudwatch_metric_alarm.lambda_errors`: Alarm for Lambda errors (optional)

### Deployment Pipeline

**Pipeline Stages**:

1. **Validate**
   - `terraform fmt -check`: Verify formatting
   - `terraform validate`: Validate configuration syntax
   - `tflint`: Lint Terraform code

2. **Test**
   - `pytest tests/`: Run unit tests
   - `pytest tests/property_tests/`: Run property-based tests
   - Coverage report generation

3. **Plan**
   - `terraform plan -out=tfplan`: Generate execution plan
   - Plan review (manual approval for production)

4. **Apply**
   - `terraform apply tfplan`: Apply infrastructure changes
   - Package Lambda code: `zip -r lambda_function.zip lambda/`
   - Deploy Lambda code: `aws lambda update-function-code`

5. **Verify**
   - Smoke test: Send test webhook to deployed endpoint
   - Verify CloudWatch logs
   - Check Teams channel for test message

**Pipeline Tools**:
- **GitHub Actions**: `.github/workflows/deploy.yml`
- **GitLab CI**: `.gitlab-ci.yml`
- **Terraform Cloud**: Remote state and execution

### State Management

- **Backend**: S3 bucket with DynamoDB table for state locking
- **State File**: `terraform.tfstate` (remote)
- **Workspaces**: `dev`, `staging`, `prod` for environment separation

## Security Considerations

### Threat Model

**Threats**:
1. Unauthorized webhook invocation (spoofed Bitbucket requests)
2. Secret exposure in logs or error messages
3. Man-in-the-middle attacks on Teams API calls
4. Denial of service via webhook flooding
5. Secret theft from compromised infrastructure

**Mitigations**:
1. HMAC-SHA256 signature verification with constant-time comparison
2. Log sanitization and secret masking
3. HTTPS-only communication enforced by urllib3
4. API Gateway throttling and Lambda concurrency limits
5. AWS Secrets Manager with IAM-based access control

### Secret Rotation

**Process**:
1. Generate new webhook secret in Bitbucket
2. Update `bitbucket-teams/webhook-secret` in Secrets Manager
3. Lambda automatically retrieves new secret on next cold start
4. No code deployment required

**Rotation Schedule**: Every 90 days (recommended)

### Compliance

- **Data Residency**: All data processed in configured AWS region
- **Encryption**: Secrets encrypted at rest with AWS KMS
- **Audit Logging**: CloudTrail logs all Secrets Manager access
- **Least Privilege**: IAM policies scoped to specific resources

## Monitoring and Observability

### CloudWatch Metrics

**Lambda Metrics**:
- `Invocations`: Total webhook requests
- `Errors`: Failed invocations
- `Duration`: Processing time
- `Throttles`: Rate-limited requests

**Custom Metrics** (via embedded metric format):
- `WebhookEventType`: Count by event type
- `SignatureVerificationFailures`: Invalid signature attempts
- `TeamsAPIFailures`: Failed Teams posts

### CloudWatch Logs

**Log Structure**:
```json
{
  "timestamp": "2024-12-09T10:30:00Z",
  "level": "INFO",
  "request_id": "abc-123",
  "event_type": "pullrequest:created",
  "message": "Successfully posted to Teams",
  "duration_ms": 245
}
```

**Log Queries**:
- Failed signature verifications: `fields @timestamp, message | filter level = "WARN" and message like /signature/`
- Teams API errors: `fields @timestamp, status_code | filter level = "ERROR" and message like /Teams/`

### Alarms

**Critical Alarms**:
- Lambda error rate > 5% over 5 minutes
- Teams API failure rate > 10% over 5 minutes
- Lambda duration > 25 seconds (approaching timeout)

**Warning Alarms**:
- Signature verification failures > 10 per hour
- Unsupported event types > 50 per hour

## Performance Considerations

### Latency Budget

- API Gateway: < 10ms
- Lambda cold start: < 1000ms
- Lambda warm execution: < 500ms
- Teams API call: < 2000ms
- **Total**: < 3500ms (well under 30s timeout)

### Optimization Strategies

1. **Secret Caching**: Cache secrets in global scope for warm invocations
2. **Connection Pooling**: Reuse urllib3 PoolManager across invocations
3. **Minimal Dependencies**: Use standard library where possible
4. **Lazy Loading**: Import modules only when needed

### Scalability

- **Concurrent Executions**: Default 1000 (configurable)
- **Burst Capacity**: 500-3000 depending on region
- **API Gateway Limits**: 10,000 requests per second
- **Expected Load**: < 100 webhooks per minute

## Future Enhancements

1. **Message Updates with DynamoDB**: Track pipeline runs and post update messages when status changes, keeping channel clean
2. **Multiple Teams Channels**: Route different events to different channels based on repository or event type
3. **Message Templates**: Customizable message formatting via configuration files
4. **Retry Queue**: SQS queue for failed Teams posts with retry logic
5. **Metrics Dashboard**: CloudWatch dashboard for operational visibility
6. **Adaptive Cards**: Upgrade from MessageCard to Adaptive Card format for richer interactions
7. **Bitbucket Cloud vs Server**: Support both Bitbucket variants with different signature schemes
8. **Power Automate Integration**: Implement true message updates via Power Automate API
