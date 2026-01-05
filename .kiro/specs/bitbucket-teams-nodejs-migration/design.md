# Design Document: Bitbucket Teams Webhook - Node.js Migration

## Overview

This document describes the design for migrating the Bitbucket Teams webhook Lambda function from Python to Node.js. The system receives Bitbucket webhook events, validates signatures, detects failure events, formats them into rich Teams Adaptive Cards, and posts them to Microsoft Teams. Only failure events are processed; all other events are silently ignored with a 200 response. The architecture is streamlined to focus on failure detection and notification.

## Architecture

The system follows a simple pipeline architecture:

```
API Gateway Event
    ↓
[Webhook Reception] - Extract headers, body, event type
    ↓
[Signature Verification] - Validate HMAC-SHA256 signature
    ↓
[Configuration Loading] - Load secrets
    ↓
[Failure Detection] - Check if event is a failure
    ↓
[Message Formatting] - Format failure into Adaptive Card
    ↓
[Teams Posting] - Post message to Teams Workflow
    ↓
API Gateway Response (200)
```

**Key Design Decision**: All non-failure events and errors return 200 OK to prevent webhook retries. Only configuration errors during initialization cause the Lambda to fail.

## Components and Interfaces

### 1. Lambda Handler (`index.js`)

**Responsibility**: Orchestrate the complete webhook processing pipeline

**Interface**:
```typescript
async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>
```

**Key Functions**:
- Load configuration on module initialization
- Extract headers and body from API Gateway event
- Handle base64 decoding if needed
- Orchestrate the processing pipeline
- Return 200 for all webhook requests (success or ignored)
- Log processing with context

**Error Handling**:
- Configuration errors → Fail fast during initialization
- All webhook processing errors → Log and return 200

### 2. Configuration Manager (`config.ts`)

**Responsibility**: Load and validate configuration from environment variables

**Interface**:
```typescript
class Configuration {
  teamsWebhookUrlSecretArn: string;
  bitbucketSecretArn: string;
  
  static loadFromEnvironment(): Configuration
}
```

**Validation Rules**:
- TEAMS_WEBHOOK_URL_SECRET_ARN is required
- BITBUCKET_SECRET_ARN is required
- Fail fast if required variables are missing

### 3. Signature Verifier (`signature.ts`)

**Responsibility**: Verify webhook signatures using HMAC-SHA256

**Interface**:
```typescript
function extractSignatureFromHeaders(headers: Record<string, string>): string | null

function computeSignature(payload: string, secret: string): string

function verifySignature(payload: string, receivedSignature: string, secret: string): boolean

function validateWebhookSignature(headers: Record<string, string>, body: string, secret: string): [boolean, string | null]
```

**Algorithm**:
- Extract signature from X-Hub-Signature header (remove 'sha256=' prefix)
- Compute HMAC-SHA256 of payload using webhook secret
- Use constant-time comparison to prevent timing attacks
- If verification fails with original body, attempt with minified JSON

### 4. Secret Retriever (`awsSecrets.ts`)

**Responsibility**: Retrieve secrets from AWS Secrets Manager with caching

**Interface**:
```typescript
function getSecretsClient(): SecretsManagerClient

function getSecret(secretArn: string): Promise<string>

function retrieveWebhookSecret(config: Configuration): Promise<string>

function retrieveTeamsUrl(config: Configuration): Promise<string>
```

**Caching Strategy**:
- Cache secrets in module-level variable for warm Lambda invocations
- Reduce AWS API calls on subsequent invocations
- Cache key is the secret ARN

### 5. Failure Detector (`failureDetector.ts`)

**Responsibility**: Detect if a webhook event is a failure event

**Interface**:
```typescript
interface FailureEvent {
  type: string;  // 'pr_declined', 'build_failed', 'deployment_failed'
  repository: string;
  author: string;
  authorEmail?: string;
  title: string;
  reason: string;
  link: string;
  timestamp: string;
}

function isFailureEvent(eventType: string, payload: any): boolean

function parseFailureEvent(eventType: string, payload: any): FailureEvent | null
```

**Supported Failure Events**:
- Pull Request Declined: `pullrequest:rejected`
- Commit Status Failed: `repo:commit_status_updated` with state='failed'
- Build Failure: Custom Bitbucket Pipelines failure events

**Parsing Logic**:
- Check event type and payload for failure indicators
- Extract failure details (repository, author, reason, link)
- Return null if not a failure event

### 6. Message Formatter (`teamsFormatter.ts`)

**Responsibility**: Format failure events into Teams Adaptive Card data

**Interface**:
```typescript
function formatFailureMessage(failureEvent: FailureEvent): Record<string, any>
```

**Adaptive Card Structure**:
- Title: Failure type and repository
- Description: Failure reason and context
- Author mention: If email available
- Link: Direct link to failure in Bitbucket
- Color: Red (#DC3545) for all failures
- Timestamp: When failure occurred

**Mention Entities**:
- Create mention entities for author email when available
- Format: `<at>Display Name</at>`
- Include in message for Teams to render as mentions

### 7. Teams Client (`teamsClient.ts`)

**Responsibility**: Post formatted messages to Microsoft Teams

**Interface**:
```typescript
function postToTeams(messageData: Record<string, any>, webhookUrl: string): Promise<boolean>
```

**HTTP Configuration**:
- Method: POST
- Headers: Content-Type: application/json
- Timeout: 10 seconds
- Success: Status 200 or 202
- Failure: Any other status (logged but doesn't fail webhook)

**Error Handling**:
- Log response status and body on failure
- Return false on any error
- Catch and log network exceptions

### 8. Logger (`loggingUtils.ts`)

**Responsibility**: Provide structured logging with context and sanitization

**Interface**:
```typescript
function sanitizeLogMessage(message: string, sensitivePatterns?: string[]): string

function logWithContext(level: string, message: string, requestId?: string, eventType?: string, context?: Record<string, any>): void
```

**Sanitization Patterns**:
- Webhook signatures: `sha256=[a-f0-9]{64}`
- Bearer tokens: `Bearer [A-Za-z0-9\-._~+/]+=*`
- Secrets: `secret["\']?\s*[:=]\s*["\']?[^"\'\s]+`

**Context Fields**:
- request_id: AWS request ID for correlation
- event_type: Bitbucket event type
- repository: Repository name
- Additional key-value pairs as needed

## Data Models

### API Gateway Proxy Event
```typescript
interface APIGatewayProxyEvent {
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
  requestContext: {
    requestId: string;
  };
}
```

### API Gateway Proxy Response
```typescript
interface APIGatewayProxyResult {
  statusCode: number;
  body: string;
}
```

### Failure Event
```typescript
interface FailureEvent {
  type: string;  // 'pr_declined', 'build_failed', 'deployment_failed'
  repository: string;
  author: string;
  authorEmail?: string;
  title: string;
  reason: string;
  link: string;
  timestamp: string;
}
```

### Bitbucket Event Structures

**Pull Request Declined Event**:
```typescript
{
  pullrequest: {
    id: number;
    title: string;
    author: { display_name: string; email_address?: string };
    state: 'DECLINED';
    links: { html: { href: string } };
  };
  repository: { full_name: string };
}
```

**Commit Status Failed Event**:
```typescript
{
  commit_status: {
    state: 'FAILED';
    key: string;  // build name
    url: string;
    commit: { hash: string };
  };
  repository: { full_name: string };
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Webhook Reception Extracts Required Fields
*For any* API Gateway proxy event with valid headers and body, the system SHALL extract the event type, signature, and body without loss of information.
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Base64 Decoding Round Trip
*For any* valid payload, if it is base64 encoded in the event, the system SHALL decode it to produce the original payload.
**Validates: Requirements 1.4**

### Property 3: Invalid JSON Returns 200
*For any* request body containing invalid JSON, the system SHALL return a 200 status code and log the error.
**Validates: Requirements 1.5**

### Property 4: Invalid Signature Returns 200
*For any* request with an invalid signature, the system SHALL return a 200 status code and log the error.
**Validates: Requirements 1.6**

### Property 5: HMAC-SHA256 Signature Computation
*For any* payload and secret, the computed HMAC-SHA256 signature SHALL match the expected signature for that payload and secret.
**Validates: Requirements 2.1, 2.2**

### Property 6: Signature Verification with Minified JSON
*For any* payload where signature verification fails with the original body, the system SHALL attempt verification with minified JSON and succeed if the minified version matches.
**Validates: Requirements 2.5**

### Property 7: Configuration Loading from Environment
*For any* set of environment variables containing required configuration, the system SHALL load all configuration values correctly.
**Validates: Requirements 3.1, 3.2**

### Property 8: Configuration Validation Fails Fast
*For any* missing required configuration variable, the system SHALL raise an error during initialization without attempting to process events.
**Validates: Requirements 3.3**

### Property 9: Secret Retrieval from AWS
*For any* valid secret ARN, the system SHALL retrieve the secret value from AWS Secrets Manager.
**Validates: Requirements 4.1, 4.2**

### Property 10: Secret Caching for Warm Invocations
*For any* secret ARN, the second retrieval of the same secret SHALL use the cached value without calling AWS Secrets Manager again.
**Validates: Requirements 4.3**

### Property 11: PR Declined Detected as Failure
*For any* pull request declined event, the failure detector SHALL identify it as a failure event.
**Validates: Requirements 5.1**

### Property 12: Commit Status Failed Detected as Failure
*For any* commit status event with state='failed', the failure detector SHALL identify it as a failure event.
**Validates: Requirements 5.2**

### Property 13: Non-Failure Events Ignored
*For any* non-failure event, the system SHALL return a 200 response without posting to Teams.
**Validates: Requirements 5.4**

### Property 14: Failure Details Extracted
*For any* failure event, the failure detector SHALL extract repository, author, title, reason, and link.
**Validates: Requirements 5.5**

### Property 15: Failure Message Includes Required Fields
*For any* failure event, the message formatter SHALL create output containing title, description, and repository information.
**Validates: Requirements 6.1**

### Property 16: PR Declined Message Formatting
*For any* PR declined failure event, the message formatter SHALL include PR ID, title, author, and reason.
**Validates: Requirements 6.2**

### Property 17: Commit Status Message Formatting
*For any* commit status failure event, the message formatter SHALL include build name, commit hash, and failure reason.
**Validates: Requirements 6.3**

### Property 18: Failure Messages Use Red Color
*For any* failure event, the message formatter SHALL assign red theme color (#DC3545).
**Validates: Requirements 6.4**

### Property 19: Mention Entity Creation
*For any* author with email information, the message formatter SHALL create a mention entity for Teams.
**Validates: Requirements 6.5**

### Property 20: Failure Link Included
*For any* failure event, the message formatter SHALL include a link to the failure event in Bitbucket.
**Validates: Requirements 6.6**

### Property 21: Teams Posting Success
*For any* valid failure message and Teams webhook URL, the Teams client SHALL post the data and return true on success (status 200 or 202).
**Validates: Requirements 7.1, 7.2**

### Property 22: Teams Posting Failure Logged
*For any* Teams API error response, the Teams client SHALL return false and log the error.
**Validates: Requirements 7.3**

### Property 23: Teams Posting Headers
*For any* Teams posting request, the system SHALL include Content-Type: application/json header.
**Validates: Requirements 7.4**

### Property 24: Teams Posting Timeout
*For any* Teams posting request, the system SHALL use a 10-second timeout.
**Validates: Requirements 7.5**

### Property 25: JSON Error Logged
*For any* JSON parsing error, the system SHALL log it with request ID and event type.
**Validates: Requirements 8.1**

### Property 26: Signature Error Logged
*For any* signature verification error, the system SHALL log it with request ID and event type.
**Validates: Requirements 8.2**

### Property 27: Configuration Error Fails Fast
*For any* configuration error, the system SHALL fail fast with descriptive error message.
**Validates: Requirements 8.3**

### Property 28: AWS Error Logged
*For any* AWS service error, the system SHALL log it with request ID and event type.
**Validates: Requirements 8.4**

### Property 29: Teams API Error Logged
*For any* Teams API error, the system SHALL log it and return 200 response.
**Validates: Requirements 8.5**

### Property 30: Log Sanitization
*For any* log message containing sensitive information (signatures, tokens, secrets), the system SHALL redact the sensitive data.
**Validates: Requirements 8.7**

### Property 31: Handler Signature
*For any* API Gateway proxy event and Lambda context, the handler SHALL accept them and return a valid API Gateway proxy response.
**Validates: Requirements 9.1, 9.2**

### Property 32: Configuration Loading on Initialization
*For any* module import, the system SHALL load configuration on initialization.
**Validates: Requirements 9.3**

### Property 33: Fail Fast on Missing Configuration
*For any* missing configuration, the system SHALL fail fast and raise an error during initialization.
**Validates: Requirements 9.4**

### Property 34: Processing Duration Logged
*For any* webhook processing, the system SHALL track the processing duration and log it.
**Validates: Requirements 9.6**

### Property 35: Success Response
*For any* successful webhook processing, the system SHALL return a 200 status code.
**Validates: Requirements 9.5**

## Error Handling

The system implements graceful error handling with a "fail silently" approach for webhook processing:

1. **Configuration Errors**: Fail fast during module initialization (Lambda won't start)
2. **Signature Verification Errors**: Log and return 200 (don't fail the webhook)
3. **JSON Parsing Errors**: Log and return 200 (don't fail the webhook)
4. **AWS Service Errors**: Log and return 200 (don't fail the webhook)
5. **Teams API Errors**: Log and return 200 (don't fail the webhook)
6. **Non-Failure Events**: Return 200 silently (no logging needed)

All errors are logged with context (request ID, event type) for debugging.

## Testing Strategy

### Unit Testing

Unit tests verify specific examples and edge cases:
- Configuration loading with valid and invalid values
- Signature verification with matching and mismatched signatures
- Failure detection for each supported failure event type
- Message formatting for each failure type
- Error handling for each error condition
- Logging and sanitization

### Property-Based Testing

Property-based tests verify universal properties across all inputs:
- Webhook reception extracts all required fields
- Base64 decoding round trip
- HMAC-SHA256 signature computation
- Configuration validation
- Secret retrieval and caching
- Failure detection for each event type
- Non-failure events are ignored
- Message formatting for each failure type
- Teams posting success and failure
- Error responses and logging
- Log sanitization

**Testing Framework**: Jest with fast-check for property-based testing
**Minimum Iterations**: 100 per property test
**Test Configuration**: Each property test tagged with feature name and property number

## Deployment Considerations

- Node.js 18.x or later runtime
- AWS Lambda execution role with permissions for:
  - Secrets Manager (GetSecretValue)
  - CloudWatch Logs (PutLogEvents)
- Environment variables for configuration
- Lambda timeout: 30 seconds (sufficient for webhook processing)
- Memory: 256 MB (sufficient for JSON processing and AWS SDK)
