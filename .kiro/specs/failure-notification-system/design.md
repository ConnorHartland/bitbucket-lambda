# Design Document: Failure Notification System

## Overview

This document describes the design for a simple failure notification system that captures failure events from Bitbucket webhooks and sends them to Microsoft Teams. The system receives webhook events, validates signatures, detects failures, formats messages, and posts them to Teams. Non-failure events are silently ignored with a 200 response.

## Architecture

The system follows a simple linear pipeline:

```
API Gateway Event
    ↓
[Extract Headers & Body]
    ↓
[Check IP Whitelist]
    ↓
[Verify Signature]
    ↓
[Load Secrets]
    ↓
[Detect Failure]
    ↓
[Format Message]
    ↓
[Post to Teams]
    ↓
Return 200 OK
```

**Key Design Decision**: All requests return 200 OK to prevent webhook retries. Only configuration errors during initialization cause failure.

## Components and Interfaces

### 1. Lambda Handler (`index.ts`)

**Responsibility**: Orchestrate the webhook processing pipeline

**Interface**:
```typescript
async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>
```

**Flow**:
- Extract event type and signature from headers
- Check if source IP is whitelisted
- Decode body if base64 encoded
- Verify signature
- Load secrets
- Detect if event is a failure
- If failure: format and post to Teams
- Return 200 OK

**Error Handling**: Log errors and return 200 for all webhook processing errors

### 2. Configuration (`config.ts`)

**Responsibility**: Load and validate configuration

**Interface**:
```typescript
class Config {
  teamsWebhookUrlSecretArn: string
  bitbucketSecretArn: string
  
  static loadFromEnvironment(): Config
}
```

**Validation**: Fail fast if required environment variables are missing

### 3. IP Whitelist Checker (`ipWhitelist.ts`)

**Responsibility**: Verify that webhook requests come from Bitbucket IP addresses

**Interface**:
```typescript
function isIpWhitelisted(sourceIp: string): boolean
```

**Validation**: Check source IP against Bitbucket's known IP ranges

### 4. Signature Verifier (`signature.ts`)

**Responsibility**: Verify webhook signatures

**Interface**:
```typescript
function verifySignature(body: string, signature: string, secret: string): boolean
```

**Algorithm**: HMAC-SHA256 with constant-time comparison

### 4. Secret Retriever (`secrets.ts`)

**Responsibility**: Retrieve secrets from AWS Secrets Manager

**Interface**:
```typescript
function getSecret(arn: string): Promise<string>
```

**Caching**: Cache secrets for warm Lambda invocations

### 5. Failure Detector (`failureDetector.ts`)

**Responsibility**: Detect and parse failure events

**Interface**:
```typescript
interface FailureEvent {
  type: string
  repository: string
  author: string
  reason: string
  link: string
}

function detectFailure(eventType: string, payload: any): FailureEvent | null
```

**Supported Events**:
- Pull Request Declined: `pullrequest:rejected`
- Commit Status Failed: `repo:commit_status_updated` with state='failed'

### 6. Message Formatter (`formatter.ts`)

**Responsibility**: Format failure events into Teams messages

**Interface**:
```typescript
function formatMessage(failure: FailureEvent): Record<string, any>
```

**Output**: Simple JSON payload with title, description, and link

### 7. Teams Client (`teamsClient.ts`)

**Responsibility**: Post messages to Teams

**Interface**:
```typescript
function postToTeams(message: Record<string, any>, webhookUrl: string): Promise<boolean>
```

**Configuration**:
- Method: POST
- Headers: Content-Type: application/json
- Timeout: 10 seconds
- Success: Status 200 or 202

### 8. Logger (`logger.ts`)

**Responsibility**: Structured logging with sanitization

**Interface**:
```typescript
function log(level: string, message: string, context?: Record<string, any>): void
```

**Sanitization**: Remove signatures, tokens, and secrets from logs

## Data Models

### Failure Event
```typescript
interface FailureEvent {
  type: string           // 'pr_declined' or 'build_failed'
  repository: string     // e.g., 'team/repo'
  author: string         // Author name
  reason: string         // Failure reason
  link: string          // Link to failure in Bitbucket
}
```

### Teams Message
```typescript
{
  title: string
  description: string
  link: string
  color: string         // Red for failures
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: IP Whitelist Validation
*For any* source IP address, the system SHALL correctly identify whether it is in the Bitbucket IP whitelist.
**Validates: Requirements 2.5.2, 2.5.3**

### Property 2: Non-Whitelisted IP Returns 200
*For any* request from a non-whitelisted IP, the system SHALL return a 200 status code and log the rejection.
**Validates: Requirements 1.2**

### Property 3: Signature Verification Accuracy
*For any* webhook body and secret, the computed HMAC-SHA256 signature SHALL match the expected signature for that body and secret.
**Validates: Requirements 2.1, 2.2**

### Property 4: Invalid Signature Returns 200
*For any* request with an invalid signature, the system SHALL return a 200 status code and log the error.
**Validates: Requirements 1.6**

### Property 5: Base64 Decoding Round Trip
*For any* valid payload, if it is base64 encoded in the event, the system SHALL decode it to produce the original payload.
**Validates: Requirements 1.5**

### Property 6: PR Declined Detected as Failure
*For any* pull request declined event, the failure detector SHALL identify it as a failure event.
**Validates: Requirements 3.1**

### Property 7: Commit Status Failed Detected as Failure
*For any* commit status event with state='failed', the failure detector SHALL identify it as a failure event.
**Validates: Requirements 3.2**

### Property 8: Non-Failure Events Ignored
*For any* non-failure event, the system SHALL return a 200 response without posting to Teams.
**Validates: Requirements 3.3**

### Property 9: Failure Details Extracted
*For any* failure event, the failure detector SHALL extract repository, author, reason, and link.
**Validates: Requirements 3.4**

### Property 10: Failure Message Contains Required Fields
*For any* failure event, the message formatter SHALL create output containing failure type, repository, reason, and link.
**Validates: Requirements 4.1, 4.2**

### Property 11: Failure Messages Use Red Color
*For any* failure event, the message formatter SHALL assign red color.
**Validates: Requirements 4.3**

### Property 12: Teams Posting Success
*For any* valid failure message and Teams webhook URL, the Teams client SHALL post the data and return true on success (status 200 or 202).
**Validates: Requirements 5.1, 5.2**

### Property 13: Teams Posting Failure Logged
*For any* Teams API error response, the Teams client SHALL return false and log the error.
**Validates: Requirements 5.3**

### Property 14: Configuration Loading from Environment
*For any* set of environment variables containing required configuration, the system SHALL load all configuration values correctly.
**Validates: Requirements 6.1, 6.2**

### Property 15: Configuration Validation Fails Fast
*For any* missing required configuration variable, the system SHALL raise an error during initialization.
**Validates: Requirements 6.5**

### Property 16: Secret Retrieval from AWS
*For any* valid secret ARN, the system SHALL retrieve the secret value from AWS Secrets Manager.
**Validates: Requirements 6.3, 6.4**

### Property 17: JSON Error Logged
*For any* JSON parsing error, the system SHALL log it with request ID and event type.
**Validates: Requirements 7.1**

### Property 18: AWS Error Logged
*For any* AWS service error, the system SHALL log it with request ID and event type.
**Validates: Requirements 7.2**

### Property 19: Teams API Error Logged
*For any* Teams API error, the system SHALL log it and return 200 response.
**Validates: Requirements 7.3**

### Property 20: Log Sanitization
*For any* log message containing sensitive information (signatures, tokens, secrets), the system SHALL redact the sensitive data.
**Validates: Requirements 7.5**

## Error Handling

The system implements graceful error handling:

1. **Configuration Errors**: Fail fast during initialization
2. **Signature Verification Errors**: Log and return 200
3. **JSON Parsing Errors**: Log and return 200
4. **AWS Service Errors**: Log and return 200
5. **Teams API Errors**: Log and return 200
6. **Non-Failure Events**: Return 200 silently

All errors are logged with context (request ID, event type) for debugging.

## Testing Strategy

### Unit Testing

Unit tests verify specific examples and edge cases:
- Signature verification with matching and mismatching signatures
- Failure detection for each supported event type
- Message formatting for each failure type
- Error handling for each error condition
- Logging and sanitization

### Property-Based Testing

Property-based tests verify universal properties across all inputs:
- HMAC-SHA256 signature computation
- Base64 decoding round trip
- Failure detection for each event type
- Non-failure events are ignored
- Message formatting for each failure type
- Teams posting success and failure
- Configuration loading and validation
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
- Lambda timeout: 30 seconds
- Memory: 256 MB
