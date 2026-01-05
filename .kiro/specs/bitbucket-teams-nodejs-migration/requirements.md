# Requirements Document: Bitbucket Teams Webhook - Node.js Migration

## Introduction

This document specifies the requirements for migrating the Bitbucket Teams webhook Lambda function from Python to Node.js. The system receives Bitbucket webhook events, validates signatures, detects failure events, formats them into rich Teams messages, and posts them to Microsoft Teams. Only failure events are processed and posted; all other events are silently ignored.

## Glossary

- **System**: The Bitbucket Teams Webhook Lambda function
- **Webhook**: HTTP callback from Bitbucket containing event data
- **Failure Event**: A Bitbucket event indicating a failure (build failure, declined PR, failed deployment, etc.)
- **Signature**: HMAC-SHA256 hash for webhook authentication
- **Teams**: Microsoft Teams platform for posting messages
- **Adaptive Card**: Microsoft Teams message format
- **AWS Secrets Manager**: Service for storing webhook secrets and Teams URL

## Requirements

### Requirement 1: Webhook Reception and Validation

**User Story:** As a system administrator, I want the Lambda function to receive and validate Bitbucket webhooks, so that only authentic requests are processed.

#### Acceptance Criteria

1. WHEN a webhook request is received, THE System SHALL extract headers and body from the API Gateway proxy event
2. WHEN a webhook request is received, THE System SHALL extract the X-Event-Key header to determine event type
3. WHEN a webhook request is received, THE System SHALL extract the X-Hub-Signature header for signature verification
4. WHEN the request body is base64 encoded, THE System SHALL decode it before processing
5. WHEN the request body contains invalid JSON, THE System SHALL return a 200 response (silently ignore)
6. WHEN signature verification fails, THE System SHALL return a 200 response (silently ignore)
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
3. WHEN required configuration is missing, THE System SHALL fail fast with descriptive error message

### Requirement 4: Secret Retrieval

**User Story:** As a system administrator, I want secrets to be retrieved from AWS Secrets Manager, so that sensitive credentials are not stored in code or environment variables.

#### Acceptance Criteria

1. THE Secret_Retriever SHALL retrieve the webhook secret from AWS Secrets Manager using the configured ARN
2. THE Secret_Retriever SHALL retrieve the Teams webhook URL from AWS Secrets Manager using the configured ARN
3. THE Secret_Retriever SHALL cache secrets for warm Lambda invocations to improve performance

### Requirement 5: Failure Event Detection

**User Story:** As a developer, I want to detect failure events from Bitbucket, so that only failures are posted to Teams.

#### Acceptance Criteria

1. WHEN a pull request declined event is received, THE System SHALL identify it as a failure event
2. WHEN a commit status failed event is received, THE System SHALL identify it as a failure event
3. WHEN a build failure event is received, THE System SHALL identify it as a failure event
4. WHEN a non-failure event is received, THE System SHALL return a 200 response (silently ignore)
5. THE System SHALL extract failure details (type, repository, author, reason, link)

### Requirement 6: Failure Message Formatting

**User Story:** As a developer, I want failure events to be formatted into rich Teams messages, so that team members get detailed information about failures.

#### Acceptance Criteria

1. THE Message_Formatter SHALL create Adaptive Card data with title, description, and repository information
2. WHEN formatting a declined PR failure, THE Message_Formatter SHALL include PR ID, title, author, and reason
3. WHEN formatting a commit status failure, THE Message_Formatter SHALL include build name, commit hash, and failure reason
4. THE Message_Formatter SHALL assign red theme color for all failure events
5. THE Message_Formatter SHALL create mention entities for author email when available
6. THE Message_Formatter SHALL include a link to the failure event in Bitbucket

### Requirement 7: Teams Message Posting

**User Story:** As a developer, I want formatted failure messages to be posted to Microsoft Teams, so that team members are notified of failures.

#### Acceptance Criteria

1. THE Teams_Client SHALL post failure data to the Teams Workflow webhook URL
2. WHEN the Teams API returns status 200 or 202, THE System SHALL consider the post successful
3. WHEN the Teams API returns any other status, THE System SHALL log the error and return 200 (do not fail the webhook)
4. THE Teams_Client SHALL include appropriate headers (Content-Type: application/json)
5. THE Teams_Client SHALL use a 10-second timeout for Teams API requests

### Requirement 8: Error Handling and Logging

**User Story:** As a developer, I want errors to be handled gracefully and logged, so that the system is resilient and debuggable.

#### Acceptance Criteria

1. WHEN a JSON parsing error occurs, THE System SHALL log it and return a 200 response
2. WHEN a signature verification error occurs, THE System SHALL log it and return a 200 response
3. WHEN a configuration error occurs, THE System SHALL fail fast with descriptive error message
4. WHEN an AWS service error occurs, THE System SHALL log it and return a 200 response
5. WHEN a Teams API error occurs, THE System SHALL log it and return a 200 response
6. WHEN an error occurs, THE System SHALL log the error with request ID and event type for debugging
7. THE Logger SHALL sanitize log messages to prevent exposure of sensitive information (signatures, tokens, secrets)

### Requirement 9: Lambda Handler

**User Story:** As a developer, I want a Lambda handler that orchestrates all components, so that the system processes webhooks end-to-end.

#### Acceptance Criteria

1. THE Lambda_Handler SHALL accept an API Gateway proxy event and context
2. THE Lambda_Handler SHALL return an API Gateway proxy response with statusCode and body
3. THE Lambda_Handler SHALL load configuration on module initialization
4. THE Lambda_Handler SHALL fail fast if configuration is not loaded
5. THE Lambda_Handler SHALL return 200 for all successful webhook processing (whether event was processed or ignored)
6. THE Lambda_Handler SHALL track processing duration and log it
