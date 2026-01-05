# Requirements Document: Bitbucket Teams Webhook - Node.js Migration

## Introduction

This document specifies the requirements for migrating the Bitbucket Teams webhook Lambda function from Python to Node.js. The system processes Bitbucket webhook events, validates signatures, filters events, parses event data, formats messages, and posts them to Microsoft Teams. The migration maintains all existing functionality while using Node.js as the runtime.

## Glossary

- **System**: The Bitbucket Teams Webhook Lambda function
- **Webhook**: HTTP callback from Bitbucket containing event data
- **Event**: A Bitbucket action (push, pull request, comment, etc.)
- **Signature**: HMAC-SHA256 hash for webhook authentication
- **Teams**: Microsoft Teams platform for posting messages
- **Adaptive Card**: Microsoft Teams message format
- **Event Filter**: Configuration to include/exclude specific event types
- **Parsed Event**: Internal representation of a Bitbucket event
- **AWS Secrets Manager**: Service for storing webhook secrets and Teams URL

## Requirements

### Requirement 1: Webhook Reception and Validation

**User Story:** As a system administrator, I want the Lambda function to receive and validate Bitbucket webhooks, so that only authentic requests are processed.

#### Acceptance Criteria

1. WHEN a webhook request is received, THE System SHALL extract headers and body from the API Gateway proxy event
2. WHEN a webhook request is received, THE System SHALL extract the X-Event-Key header to determine event type
3. WHEN a webhook request is received, THE System SHALL extract the X-Hub-Signature header for signature verification
4. WHEN the request body is base64 encoded, THE System SHALL decode it before processing
5. WHEN the request body contains invalid JSON, THE System SHALL return a 400 error with descriptive message
6. WHEN signature verification fails, THE System SHALL return a 401 Unauthorized response without further processing
7. WHEN signature verification succeeds, THE System SHALL proceed with event processing

### Requirement 2: Signature Verification

**User Story:** As a security officer, I want webhook signatures to be verified using HMAC-SHA256, so that only authentic Bitbucket events are processed.

#### Acceptance Criteria

1. THE Signature_Verifier SHALL compute HMAC-SHA256 signatures using the webhook secret
2. WHEN a signature is provided in the X-Hub-Signature header, THE System SHALL extract it (removing the 'sha256=' prefix)
3. WHEN the computed signature matches the received signature, THE System SHALL mark the request as valid
4. WHEN the computed signature does not match the received signature, THE System SHALL mark the request as invalid
5. WHEN signature verification fails with the original body, THE System SHALL attempt verification with minified JSON
6. THE System SHALL use constant-time comparison to prevent timing attacks

### Requirement 3: Configuration Management

**User Story:** As a system administrator, I want configuration to be loaded from environment variables, so that the system can be deployed to different environments.

#### Acceptance Criteria

1. THE Configuration_Manager SHALL load TEAMS_WEBHOOK_URL_SECRET_ARN from environment variables
2. THE Configuration_Manager SHALL load BITBUCKET_SECRET_ARN from environment variables
3. THE Configuration_Manager SHALL load EVENT_FILTER from environment variables (optional)
4. THE Configuration_Manager SHALL load FILTER_MODE from environment variables (optional, defaults to 'all')
5. WHEN required configuration is missing, THE System SHALL fail fast with descriptive error message
6. WHEN configuration is invalid, THE System SHALL fail fast with descriptive error message

### Requirement 4: Secret Retrieval

**User Story:** As a system administrator, I want secrets to be retrieved from AWS Secrets Manager, so that sensitive credentials are not stored in code or environment variables.

#### Acceptance Criteria

1. THE Secret_Retriever SHALL retrieve the webhook secret from AWS Secrets Manager using the configured ARN
2. THE Secret_Retriever SHALL retrieve the Teams webhook URL from AWS Secrets Manager using the configured ARN
3. WHEN a secret retrieval fails, THE System SHALL return a 500 error with descriptive message
4. THE Secret_Retriever SHALL cache secrets for warm Lambda invocations to improve performance
5. WHEN a secret retrieval fails due to AWS service error, THE System SHALL log the error code and message

### Requirement 5: Event Filtering

**User Story:** As a system administrator, I want to filter webhook events based on configuration, so that only relevant events are processed.

#### Acceptance Criteria

1. WHEN filter_mode is 'all', THE System SHALL process all event types
2. WHEN filter_mode is 'deployments', THE System SHALL only process deployment-related events (commit status, approvals)
3. WHEN filter_mode is 'failures', THE System SHALL only process failure events (failed builds, declined PRs)
4. WHEN filter_mode is 'explicit', THE System SHALL only process event types listed in EVENT_FILTER
5. WHEN an event is filtered out, THE System SHALL return a 200 response indicating the event was filtered
6. WHEN an event passes the filter, THE System SHALL proceed with event processing

### Requirement 6: Event Parsing

**User Story:** As a developer, I want Bitbucket events to be parsed into a consistent internal format, so that downstream processing is simplified.

#### Acceptance Criteria

1. WHEN a pull request event is received, THE Event_Parser SHALL extract PR details (ID, title, author, branches, state)
2. WHEN a push event is received, THE Event_Parser SHALL extract push details (branch, commits, author)
3. WHEN a comment event is received, THE Event_Parser SHALL extract comment details (text, author, context)
4. WHEN a commit status event is received, THE Event_Parser SHALL extract status details (state, build name, commit hash)
5. WHEN an unsupported event type is received, THE Event_Parser SHALL return null to indicate no processing needed
6. WHEN required fields are missing from the payload, THE Event_Parser SHALL raise a ValueError with descriptive message
7. THE Event_Parser SHALL extract author email when available for mention support

### Requirement 7: Message Formatting

**User Story:** As a developer, I want parsed events to be formatted into Teams Adaptive Card data, so that messages display correctly in Teams.

#### Acceptance Criteria

1. THE Message_Formatter SHALL create Adaptive Card data with title, description, and repository information
2. WHEN formatting a pull request event, THE Message_Formatter SHALL include PR ID, source branch, target branch, and state
3. WHEN formatting a push event, THE Message_Formatter SHALL include branch name, commit count, and recent commits
4. WHEN formatting a comment event, THE Message_Formatter SHALL include context (PR or commit) and comment text
5. WHEN formatting a commit status event, THE Message_Formatter SHALL include build name, status, and commit hash
6. THE Message_Formatter SHALL assign theme colors based on event type and action (red for failures, green for success, blue for PRs, purple for pushes)
7. THE Message_Formatter SHALL create mention entities for author email when available
8. WHEN parsed_event is null, THE Message_Formatter SHALL raise a ValueError

### Requirement 8: Teams Message Posting

**User Story:** As a developer, I want formatted messages to be posted to Microsoft Teams, so that team members are notified of Bitbucket events.

#### Acceptance Criteria

1. THE Teams_Client SHALL post event data to the Teams Workflow webhook URL
2. WHEN the Teams API returns status 200 or 202, THE System SHALL consider the post successful
3. WHEN the Teams API returns any other status, THE System SHALL consider the post failed and log the error
4. WHEN posting to Teams fails, THE System SHALL return a 500 error response
5. THE Teams_Client SHALL include appropriate headers (Content-Type: application/json)
6. THE Teams_Client SHALL use a 10-second timeout for Teams API requests

### Requirement 9: Error Handling

**User Story:** As a developer, I want errors to be handled gracefully with appropriate HTTP responses, so that the system is resilient to malformed requests and service failures.

#### Acceptance Criteria

1. WHEN a JSON parsing error occurs, THE System SHALL return a 400 error with 'Invalid JSON payload' message
2. WHEN a signature verification error occurs, THE System SHALL return a 401 error with 'Unauthorized' message
3. WHEN a configuration error occurs, THE System SHALL return a 500 error with 'Server configuration error' message
4. WHEN an AWS service error occurs, THE System SHALL return a 500 error with 'Service configuration error' message
5. WHEN a network error occurs, THE System SHALL return a 500 error with 'Service temporarily unavailable' message
6. WHEN an unexpected error occurs, THE System SHALL return a 500 error with 'Internal server error' message
7. WHEN an error occurs, THE System SHALL log the error with request ID and event type for debugging

### Requirement 10: Logging and Observability

**User Story:** As a system administrator, I want comprehensive logging with context information, so that I can debug issues and monitor system health.

#### Acceptance Criteria

1. THE Logger SHALL log all major processing steps (configuration load, signature verification, event parsing, Teams posting)
2. WHEN logging, THE Logger SHALL include request ID for request correlation
3. WHEN logging, THE Logger SHALL include event type for event tracking
4. WHEN logging, THE Logger SHALL include repository name for repository tracking
5. THE Logger SHALL sanitize log messages to prevent exposure of sensitive information (signatures, tokens, secrets)
6. WHEN an error occurs, THE Logger SHALL log the error type and message for debugging
7. THE Logger SHALL emit custom CloudWatch metrics for event types, failures, and processing duration

### Requirement 11: Metrics and Monitoring

**User Story:** As a system administrator, I want custom metrics to be emitted to CloudWatch, so that I can monitor system performance and failures.

#### Acceptance Criteria

1. THE Metrics_Emitter SHALL emit a metric for each event type received
2. THE Metrics_Emitter SHALL emit a metric when signature verification fails
3. THE Metrics_Emitter SHALL emit a metric when Teams API posting fails
4. THE Metrics_Emitter SHALL emit a metric when an unsupported event type is received
5. THE Metrics_Emitter SHALL emit a metric for processing duration in milliseconds
6. THE Metrics_Emitter SHALL use CloudWatch Embedded Metric Format (EMF) for metric emission

### Requirement 12: Lambda Handler

**User Story:** As a developer, I want a Lambda handler that orchestrates all components, so that the system processes webhooks end-to-end.

#### Acceptance Criteria

1. THE Lambda_Handler SHALL accept an API Gateway proxy event and context
2. THE Lambda_Handler SHALL return an API Gateway proxy response with statusCode and body
3. THE Lambda_Handler SHALL load configuration on module initialization
4. THE Lambda_Handler SHALL fail fast if configuration is not loaded
5. THE Lambda_Handler SHALL fail fast if filter configuration is not loaded
6. THE Lambda_Handler SHALL track processing duration and include it in the response
7. THE Lambda_Handler SHALL include request ID, event type, and event category in the response
8. WHEN processing succeeds, THE Lambda_Handler SHALL return a 200 response with success message
9. WHEN an event is filtered, THE Lambda_Handler SHALL return a 200 response with filter message
10. WHEN an event type is unsupported, THE Lambda_Handler SHALL return a 200 response with unsupported message
