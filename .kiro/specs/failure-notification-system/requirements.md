# Requirements Document: Failure Notification System

## Introduction

This document specifies the requirements for a simple failure notification system that captures failure events from Bitbucket webhooks and sends them to Microsoft Teams. The system receives webhook events, validates them, detects failures, and posts notifications to Teams.

## Glossary

- **System**: The Bitbucket Teams Webhook Lambda function
- **Webhook**: HTTP callback from Bitbucket containing event data
- **Failure Event**: A Bitbucket event indicating a failure (PR declined, build failed, etc.)
- **Signature**: HMAC-SHA256 hash for webhook authentication
- **Teams**: Microsoft Teams platform for posting messages
- **AWS Secrets Manager**: Service for storing webhook secrets and Teams URL

## Requirements

### Requirement 1: Receive and Validate Webhooks

**User Story:** As a system administrator, I want the system to receive Bitbucket webhooks and validate their authenticity, so that only legitimate events are processed.

#### Acceptance Criteria

1. WHEN a webhook request is received, THE System SHALL check if the source IP is whitelisted
2. WHEN the source IP is not whitelisted, THE System SHALL return a 200 response and log the rejection
3. WHEN a webhook request is received, THE System SHALL extract the event type from headers
4. WHEN a webhook request is received, THE System SHALL extract the signature from headers
5. WHEN the request body is base64 encoded, THE System SHALL decode it
6. WHEN signature verification fails, THE System SHALL return a 200 response and log the error
7. WHEN signature verification succeeds, THE System SHALL proceed with event processing

### Requirement 2: Verify Webhook Signatures

**User Story:** As a security officer, I want webhook signatures verified using HMAC-SHA256, so that only authentic Bitbucket events are processed.

#### Acceptance Criteria

1. THE System SHALL compute HMAC-SHA256 signatures using the webhook secret
2. WHEN the computed signature matches the received signature, THE System SHALL mark the request as valid
3. WHEN the computed signature does not match, THE System SHALL mark the request as invalid

### Requirement 2.5: IP Whitelist Validation

**User Story:** As a security officer, I want to restrict webhook access to Bitbucket's IP addresses, so that unauthorized sources cannot trigger the system.

#### Acceptance Criteria

1. THE System SHALL maintain a list of Bitbucket IP ranges
2. WHEN a webhook request is received, THE System SHALL verify the source IP is in the whitelist
3. WHEN the source IP is not whitelisted, THE System SHALL return a 200 response and log the rejection

### Requirement 3: Detect Failure Events

**User Story:** As a developer, I want the system to identify failure events from Bitbucket, so that only failures trigger notifications.

#### Acceptance Criteria

1. WHEN a pull request declined event is received, THE System SHALL identify it as a failure
2. WHEN a commit status failed event is received, THE System SHALL identify it as a failure
3. WHEN a non-failure event is received, THE System SHALL return a 200 response and ignore it
4. THE System SHALL extract failure details (repository, author, reason, link)

### Requirement 4: Format Failure Messages

**User Story:** As a developer, I want failure events formatted into Teams messages, so that team members get clear notifications.

#### Acceptance Criteria

1. THE System SHALL create a Teams message with failure type, repository, and reason
2. WHEN formatting a failure, THE System SHALL include a link to the failure in Bitbucket
3. THE System SHALL use red color for all failure messages

### Requirement 5: Post Messages to Teams

**User Story:** As a developer, I want failure messages posted to Microsoft Teams, so that team members are notified.

#### Acceptance Criteria

1. THE System SHALL post failure messages to the Teams webhook URL
2. WHEN the Teams API returns status 200 or 202, THE System SHALL consider it successful
3. WHEN the Teams API returns any other status, THE System SHALL log the error and return 200

### Requirement 6: Load Configuration

**User Story:** As a system administrator, I want configuration loaded from environment variables and AWS Secrets Manager, so that the system can be deployed to different environments.

#### Acceptance Criteria

1. THE System SHALL load TEAMS_WEBHOOK_URL_SECRET_ARN from environment variables
2. THE System SHALL load BITBUCKET_SECRET_ARN from environment variables
3. THE System SHALL retrieve the webhook secret from AWS Secrets Manager
4. THE System SHALL retrieve the Teams webhook URL from AWS Secrets Manager
5. WHEN required configuration is missing, THE System SHALL fail fast with an error

### Requirement 7: Handle Errors Gracefully

**User Story:** As a developer, I want errors handled gracefully and logged, so that the system is resilient and debuggable.

#### Acceptance Criteria

1. WHEN a JSON parsing error occurs, THE System SHALL log it and return a 200 response
2. WHEN an AWS service error occurs, THE System SHALL log it and return a 200 response
3. WHEN a Teams API error occurs, THE System SHALL log it and return a 200 response
4. WHEN an error occurs, THE System SHALL log it with request ID and event type for debugging
5. THE System SHALL sanitize log messages to prevent exposure of sensitive information
