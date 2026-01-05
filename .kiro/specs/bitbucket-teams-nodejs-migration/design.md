# Design Document: Bitbucket Teams Webhook - Node.js Migration

## Overview

This document describes the design for migrating the Bitbucket Teams webhook Lambda function from Python to Node.js. The system maintains all existing functionality while leveraging Node.js runtime capabilities. The architecture follows a modular design with clear separation of concerns: webhook reception, signature verification, event filtering, event parsing, message formatting, and Teams posting.

## Architecture

The system follows a pipeline architecture where each component processes the webhook event and passes it to the next stage:

```
API Gateway Event
    ↓
[Webhook Reception] - Extract headers, body, event type
    ↓
[Signature Verification] - Validate HMAC-SHA256 signature
    ↓
[Configuration Loading] - Load secrets and filter config
    ↓
[Event Filtering] - Filter events based on configuration
    ↓
[Event Parsing] - Parse Bitbucket event into internal format
    ↓
[Message Formatting] - Format parsed event for Teams
    ↓
[Teams Posting] - Post message to Teams Workflow
    ↓
API Gateway Response
```

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
- Handle errors and return appropriate HTTP responses
- Track processing duration
- Emit metrics

**Error Handling**:
- Configuration errors → 500 with "Server configuration error"
- JSON parsing errors → 400 with "Invalid JSON payload"
- Signature verification failures → 401 with "Unauthorized"
- AWS service errors → 500 with "Service configuration error"
- Network errors → 500 with "Service temporarily unavailable"
- Unexpected errors → 500 with "Internal server error"

### 2. Configuration Manager (`config.ts`)

**Responsibility**: Load and validate configuration from environment variables

**Interface**:
```typescript
class Configuration {
  teamsWebhookUrlSecretArn: string;
  bitbucketSecretArn: string;
  eventFilter: string;
  filterMode: string;
  
  static loadFromEnvironment(): Configuration
}

class FilterConfig {
  mode: string;
  eventTypes: string[];
  
  static fromEnvironment(eventFilter: string, filterMode: string): FilterConfig
  shouldProcess(eventType: string, eventData: object): boolean
}
```

**Validation Rules**:
- TEAMS_WEBHOOK_URL_SECRET_ARN is required
- BITBUCKET_SECRET_ARN is required
- EVENT_FILTER is optional (defaults to empty string)
- FILTER_MODE is optional (defaults to 'all')
- Fail fast if required variables are missing

**Filter Modes**:
- `all`: Process all event types
- `deployments`: Only process deployment-related events (commit status, approvals)
- `failures`: Only process failure events (failed builds, declined PRs)
- `explicit`: Only process event types listed in EVENT_FILTER

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

**Error Handling**:
- Log AWS error codes and messages
- Throw exceptions for caller to handle

### 5. Event Parser (`eventParser.ts`)

**Responsibility**: Parse Bitbucket webhook events into internal format

**Data Structure**:
```typescript
interface ParsedEvent {
  eventCategory: string;  // 'pull_request', 'push', 'comment', 'commit_status'
  repository: string;
  action: string;
  author: string;
  title: string | null;
  description: string | null;
  url: string;
  metadata: Record<string, any>;
}
```

**Supported Event Types**:
- Pull Request: `pullrequest:created`, `pullrequest:updated`, `pullrequest:fulfilled`, `pullrequest:rejected`, `pullrequest:approved`, `pullrequest:unapproved`
- Push: `repo:push`
- Comments: `pullrequest:comment_created`, `repo:commit_comment_created`
- Commit Status: `repo:commit_status_updated`, `repo:commit_status_created`

**Parsing Logic**:
- Extract repository name from payload
- Route to appropriate parser based on event type
- Extract event-specific fields into metadata
- Return null for unsupported event types
- Raise ValueError for malformed payloads

### 6. Message Formatter (`teamsFormatter.ts`)

**Responsibility**: Format parsed events into Teams Adaptive Card data

**Interface**:
```typescript
function getEventColor(eventCategory: string, action: string, metadata: Record<string, any>): string

function createMentionEntity(email: string, displayName: string): MentionEntity | null

function createAdaptiveCardData(parsedEvent: ParsedEvent): Record<string, any>

function formatTeamsMessage(parsedEvent: ParsedEvent): Record<string, any>
```

**Color Scheme**:
- Red (#DC3545): Failures, declined PRs, stopped builds
- Green (#28A745): Merged PRs, successful builds
- Blue (#0078D4): Pull request events
- Purple (#6264A7): Push events
- Yellow (#FFC107): In-progress builds
- Gray (#6C757D): Comments and other events

**Mention Entities**:
- Create mention entities for author email when available
- Format: `<at>Display Name</at>`
- Include in message for Teams to render as mentions

### 7. Teams Client (`teamsClient.ts`)

**Responsibility**: Post formatted messages to Microsoft Teams

**Interface**:
```typescript
function postToTeams(eventData: Record<string, any>, webhookUrl: string): Promise<boolean>
```

**HTTP Configuration**:
- Method: POST
- Headers: Content-Type: application/json
- Timeout: 10 seconds
- Success: Status 200 or 202
- Failure: Any other status

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
- Passwords: `password["\']?\s*[:=]\s*["\']?[^"\'\s]+`
- Secrets: `secret["\']?\s*[:=]\s*["\']?[^"\'\s]+`
- Tokens: `token["\']?\s*[:=]\s*["\']?[^"\'\s]+`

**Context Fields**:
- request_id: AWS request ID for correlation
- event_type: Bitbucket event type
- repository: Repository name
- action: Event action
- Additional key-value pairs as needed

### 9. Metrics Emitter (`metrics.ts`)

**Responsibility**: Emit custom metrics to CloudWatch using EMF

**Interface**:
```typescript
class CustomMetrics {
  static emitMetric(metricName: string, value?: number, unit?: string, namespace?: string, dimensions?: Record<string, string>): void
  
  static emitEventTypeMetric(eventType: string): void
  
  static emitSignatureFailure(): void
  
  static emitTeamsAPIFailure(): void
  
  static emitUnsupportedEvent(): void
  
  static emitProcessingDuration(durationMs: number): void
}
```

**Metric Format**: CloudWatch Embedded Metric Format (EMF)
- Namespace: `BitbucketTeamsWebhook`
- Dimensions: Event type, error type, etc.
- Units: Count, Milliseconds

**Metrics Emitted**:
- EventType-{eventType}: Count of each event type
- SignatureVerificationFailures: Count of signature failures
- TeamsAPIFailures: Count of Teams API failures
- UnsupportedEventTypes: Count of unsupported events
- ProcessingDuration: Processing time in milliseconds

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

### Bitbucket Event Structures

**Pull Request Event**:
```typescript
{
  pullrequest: {
    id: number;
    title: string;
    description: string;
    author: { display_name: string; email_address?: string };
    source: { branch: { name: string } };
    destination: { branch: { name: string } };
    state: string;
    links: { html: { href: string } };
  };
  repository: { full_name: string };
}
```

**Push Event**:
```typescript
{
  push: {
    changes: [{
      new: { name: string };
      commits: [{
        hash: string;
        message: string;
        author: { user: { display_name: string } };
        links: { html: { href: string } };
      }];
    }];
  };
  actor: { display_name: string; email_address?: string };
  repository: { full_name: string };
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Webhook Reception Extracts All Required Fields
*For any* API Gateway proxy event with valid headers and body, the system SHALL extract the event type, signature, and body without loss of information.
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Base64 Decoding Round Trip
*For any* valid payload, if it is base64 encoded in the event, the system SHALL decode it to produce the original payload.
**Validates: Requirements 1.4**

### Property 3: Invalid JSON Rejected with 400
*For any* request body containing invalid JSON, the system SHALL return a 400 status code with an error message.
**Validates: Requirements 1.5**

### Property 4: Signature Verification Prevents Invalid Requests
*For any* request with an invalid signature, the system SHALL return a 401 status code without processing the event further.
**Validates: Requirements 1.6, 2.3, 2.4**

### Property 5: HMAC-SHA256 Signature Computation
*For any* payload and secret, the computed HMAC-SHA256 signature SHALL match the expected signature for that payload and secret.
**Validates: Requirements 2.1, 2.2**

### Property 6: Signature Verification with Minified JSON
*For any* payload where signature verification fails with the original body, the system SHALL attempt verification with minified JSON and succeed if the minified version matches.
**Validates: Requirements 2.5**

### Property 7: Configuration Loading from Environment
*For any* set of environment variables containing required configuration, the system SHALL load all configuration values correctly.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 8: Configuration Validation Fails Fast
*For any* missing required configuration variable, the system SHALL raise an error during initialization without attempting to process events.
**Validates: Requirements 3.5, 3.6**

### Property 9: Secret Retrieval from AWS
*For any* valid secret ARN, the system SHALL retrieve the secret value from AWS Secrets Manager.
**Validates: Requirements 4.1, 4.2**

### Property 10: Secret Caching for Warm Invocations
*For any* secret ARN, the second retrieval of the same secret SHALL use the cached value without calling AWS Secrets Manager again.
**Validates: Requirements 4.4**

### Property 11: Filter Mode 'all' Processes All Events
*For any* event type, when filter mode is 'all', the system SHALL process the event (not filter it out).
**Validates: Requirements 5.1**

### Property 12: Filter Mode 'deployments' Filters Correctly
*For any* event type, when filter mode is 'deployments', the system SHALL process only deployment-related events (commit status, approvals).
**Validates: Requirements 5.2**

### Property 13: Filter Mode 'failures' Filters Correctly
*For any* event type, when filter mode is 'failures', the system SHALL process only failure events (failed builds, declined PRs).
**Validates: Requirements 5.3**

### Property 14: Filter Mode 'explicit' Filters Correctly
*For any* event type and explicit event filter list, when filter mode is 'explicit', the system SHALL process only events in the filter list.
**Validates: Requirements 5.4**

### Property 15: Filtered Events Return 200
*For any* event that is filtered out, the system SHALL return a 200 status code with a message indicating the event was filtered.
**Validates: Requirements 5.5**

### Property 16: Pull Request Event Parsing
*For any* valid pull request event, the event parser SHALL extract PR ID, title, author, source branch, target branch, and state.
**Validates: Requirements 6.1**

### Property 17: Push Event Parsing
*For any* valid push event, the event parser SHALL extract branch name, commit count, and recent commits.
**Validates: Requirements 6.2**

### Property 18: Comment Event Parsing
*For any* valid comment event, the event parser SHALL extract comment text, author, and context (PR or commit).
**Validates: Requirements 6.3**

### Property 19: Commit Status Event Parsing
*For any* valid commit status event, the event parser SHALL extract build name, status, and commit hash.
**Validates: Requirements 6.4**

### Property 20: Unsupported Event Type Returns Null
*For any* unsupported event type, the event parser SHALL return null to indicate no processing is needed.
**Validates: Requirements 6.5**

### Property 21: Malformed Payload Raises Error
*For any* payload with missing required fields, the event parser SHALL raise an error with a descriptive message.
**Validates: Requirements 6.6**

### Property 22: Author Email Extraction
*For any* event with author email information, the event parser SHALL extract and include the email in metadata.
**Validates: Requirements 6.7**

### Property 23: Message Formatting Includes Required Fields
*For any* parsed event, the message formatter SHALL create output containing title, description, and repository information.
**Validates: Requirements 7.1**

### Property 24: Pull Request Message Formatting
*For any* parsed pull request event, the message formatter SHALL include PR ID, source branch, target branch, and state.
**Validates: Requirements 7.2**

### Property 25: Push Message Formatting
*For any* parsed push event, the message formatter SHALL include branch name, commit count, and recent commits.
**Validates: Requirements 7.3**

### Property 26: Comment Message Formatting
*For any* parsed comment event, the message formatter SHALL include context and comment text.
**Validates: Requirements 7.4**

### Property 27: Commit Status Message Formatting
*For any* parsed commit status event, the message formatter SHALL include build name, status, and commit hash.
**Validates: Requirements 7.5**

### Property 28: Theme Color Assignment
*For any* event type and action, the message formatter SHALL assign an appropriate theme color (red for failures, green for success, blue for PRs, purple for pushes).
**Validates: Requirements 7.6**

### Property 29: Mention Entity Creation
*For any* author with email information, the message formatter SHALL create a mention entity for Teams.
**Validates: Requirements 7.7**

### Property 30: Null Event Formatting Raises Error
*For any* null parsed event, the message formatter SHALL raise an error.
**Validates: Requirements 7.8**

### Property 31: Teams Posting Success
*For any* valid event data and Teams webhook URL, the Teams client SHALL post the data and return true on success (status 200 or 202).
**Validates: Requirements 8.1, 8.2**

### Property 32: Teams Posting Failure
*For any* Teams API error response, the Teams client SHALL return false and log the error.
**Validates: Requirements 8.3**

### Property 33: Teams Posting Headers
*For any* Teams posting request, the system SHALL include Content-Type: application/json header.
**Validates: Requirements 8.5**

### Property 34: Teams Posting Timeout
*For any* Teams posting request, the system SHALL use a 10-second timeout.
**Validates: Requirements 8.6**

### Property 35: JSON Error Response
*For any* JSON parsing error, the system SHALL return a 400 status code with 'Invalid JSON payload' message.
**Validates: Requirements 9.1**

### Property 36: Signature Error Response
*For any* signature verification error, the system SHALL return a 401 status code with 'Unauthorized' message.
**Validates: Requirements 9.2**

### Property 37: Configuration Error Response
*For any* configuration error, the system SHALL return a 500 status code with 'Server configuration error' message.
**Validates: Requirements 9.3**

### Property 38: AWS Error Response
*For any* AWS service error, the system SHALL return a 500 status code with 'Service configuration error' message.
**Validates: Requirements 9.4**

### Property 39: Network Error Response
*For any* network error, the system SHALL return a 500 status code with 'Service temporarily unavailable' message.
**Validates: Requirements 9.5**

### Property 40: Unexpected Error Response
*For any* unexpected error, the system SHALL return a 500 status code with 'Internal server error' message.
**Validates: Requirements 9.6**

### Property 41: Error Logging with Context
*For any* error, the system SHALL log the error with request ID and event type for debugging.
**Validates: Requirements 9.7**

### Property 42: Major Steps Logging
*For any* successful webhook processing, the system SHALL log all major processing steps (configuration load, signature verification, event parsing, Teams posting).
**Validates: Requirements 10.1**

### Property 43: Request ID in Logs
*For any* log entry, the system SHALL include the request ID for request correlation.
**Validates: Requirements 10.2**

### Property 44: Event Type in Logs
*For any* log entry, the system SHALL include the event type for event tracking.
**Validates: Requirements 10.3**

### Property 45: Repository in Logs
*For any* log entry related to event processing, the system SHALL include the repository name.
**Validates: Requirements 10.4**

### Property 46: Log Sanitization
*For any* log message containing sensitive information (signatures, tokens, secrets), the system SHALL redact the sensitive data.
**Validates: Requirements 10.5**

### Property 47: Error Type Logging
*For any* error, the system SHALL log the error type and message.
**Validates: Requirements 10.6**

### Property 48: Metrics Emission
*For any* webhook processing, the system SHALL emit custom CloudWatch metrics for event types, failures, and processing duration.
**Validates: Requirements 10.7, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**

### Property 49: Handler Signature
*For any* API Gateway proxy event and Lambda context, the handler SHALL accept them and return a valid API Gateway proxy response.
**Validates: Requirements 12.1, 12.2**

### Property 50: Configuration Loading on Initialization
*For any* module import, the system SHALL load configuration on initialization.
**Validates: Requirements 12.3**

### Property 51: Fail Fast on Missing Configuration
*For any* missing configuration, the system SHALL fail fast and return a 500 error without processing events.
**Validates: Requirements 12.4, 12.5**

### Property 52: Processing Duration Tracking
*For any* webhook processing, the system SHALL track the processing duration and include it in the response.
**Validates: Requirements 12.6**

### Property 53: Response Includes Context
*For any* successful webhook processing, the response SHALL include request ID, event type, and event category.
**Validates: Requirements 12.7**

### Property 54: Success Response
*For any* successful webhook processing, the system SHALL return a 200 status code with a success message.
**Validates: Requirements 12.8**

### Property 55: Filtered Event Response
*For any* filtered event, the system SHALL return a 200 status code with a filter message.
**Validates: Requirements 12.9**

### Property 56: Unsupported Event Response
*For any* unsupported event type, the system SHALL return a 200 status code with an unsupported message.
**Validates: Requirements 12.10**

## Error Handling

The system implements comprehensive error handling at multiple levels:

1. **Configuration Errors**: Fail fast during module initialization
2. **Signature Verification Errors**: Return 401 without processing
3. **JSON Parsing Errors**: Return 400 with descriptive message
4. **AWS Service Errors**: Return 500 with service error message
5. **Network Errors**: Return 500 with temporary unavailability message
6. **Unexpected Errors**: Return 500 with generic error message

All errors are logged with context (request ID, event type) for debugging.

## Testing Strategy

### Unit Testing

Unit tests verify specific examples and edge cases:
- Configuration loading with valid and invalid values
- Signature verification with matching and mismatched signatures
- Event parsing for each supported event type
- Message formatting for each event category
- Error handling for each error condition
- Logging and sanitization

### Property-Based Testing

Property-based tests verify universal properties across all inputs:
- Webhook reception extracts all required fields
- Base64 decoding round trip
- HMAC-SHA256 signature computation
- Configuration validation
- Secret retrieval and caching
- Event filtering for each mode
- Event parsing for each event type
- Message formatting for each event category
- Teams posting success and failure
- Error responses for each error type
- Logging includes required context
- Metrics emission

**Testing Framework**: Jest with fast-check for property-based testing
**Minimum Iterations**: 100 per property test
**Test Configuration**: Each property test tagged with feature name and property number

## Deployment Considerations

- Node.js 18.x or later runtime
- AWS Lambda execution role with permissions for:
  - Secrets Manager (GetSecretValue)
  - CloudWatch Logs (PutLogEvents)
  - CloudWatch Metrics (PutMetricData)
- Environment variables for configuration
- Lambda timeout: 30 seconds (sufficient for webhook processing)
- Memory: 256 MB (sufficient for JSON processing and AWS SDK)
