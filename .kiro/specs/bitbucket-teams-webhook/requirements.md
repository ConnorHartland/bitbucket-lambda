# Requirements Document: Bitbucket to Teams Webhook Integration

## Introduction

This document specifies a Lambda function that receives Bitbucket webhook events for repository status updates and publishes failure notifications to Microsoft Teams. The system validates webhook authenticity, detects failures, formats messages, and posts them to Teams. Non-failure events are silently ignored.

## Glossary

- **Bitbucket Webhook**: An HTTP POST request sent by Bitbucket to notify external systems of repository events
- **Webhook Signature**: HMAC-SHA256 hash used to verify webhook authenticity
- **Failure Event**: A webhook event indicating a build failure or pull request rejection
- **Teams Webhook URL**: Microsoft Teams incoming webhook URL for posting messages
- **Lambda Handler**: AWS Lambda function entry point that processes incoming events
- **API Gateway Event**: HTTP request event passed to Lambda by AWS API Gateway

## Requirements

### Requirement 1: Webhook Reception and Validation

**User Story:** As a system operator, I want the Lambda function to receive and validate Bitbucket webhooks, so that only authentic events are processed.

#### Acceptance Criteria

1. WHEN a webhook request is received, THE Lambda_Handler SHALL extract the event type from the `X-Event-Key` header
2. WHEN a webhook request is received, THE Lambda_Handler SHALL extract the signature from the `X-Hub-Signature` header
3. WHEN the request body is base64 encoded, THE Lambda_Handler SHALL decode it to retrieve the original payload
4. WHEN a webhook request is received, THE Lambda_Handler SHALL verify the signature using HMAC-SHA256
5. IF the signature is invalid, THEN THE Lambda_Handler SHALL return HTTP 200 and log the rejection
6. WHEN a webhook request is received, THE Lambda_Handler SHALL return HTTP 200 for all webhook processing outcomes

### Requirement 2: IP Whitelist Validation

**User Story:** As a security officer, I want the Lambda function to validate that webhooks come from Bitbucket IP addresses, so that unauthorized sources cannot trigger notifications.

#### Acceptance Criteria

1. WHEN a webhook request is received, THE IP_Validator SHALL extract the source IP from the `X-Forwarded-For` header or the Lambda event context
2. WHEN a webhook request is received, THE IP_Validator SHALL check if the source IP is in the Bitbucket IP whitelist
3. IF the source IP is not whitelisted, THEN THE Lambda_Handler SHALL return HTTP 200 and log the rejection
4. THE IP_Validator SHALL maintain an up-to-date list of Bitbucket IP ranges
5. WHERE IP restriction is enabled via environment variable, THE Lambda_Handler SHALL enforce IP validation before processing the webhook

### Requirement 3: Failure Detection

**User Story:** As a developer, I want the system to detect repository failures, so that I am notified only of important events.

#### Acceptance Criteria

1. WHEN a `repo:commit_status_updated` event is received with state='failed', THE Failure_Detector SHALL identify it as a failure event
2. WHEN a `pullrequest:rejected` event is received, THE Failure_Detector SHALL identify it as a failure event
3. WHEN a non-failure event is received, THE Lambda_Handler SHALL return HTTP 200 without posting to Teams
4. WHEN a failure event is detected, THE Failure_Detector SHALL extract repository name, author, failure reason, and link to the failure

### Requirement 4: Message Formatting

**User Story:** As a Teams user, I want failure notifications formatted clearly, so that I can quickly understand what failed.

#### Acceptance Criteria

1. WHEN a failure event is detected, THE Message_Formatter SHALL create a Teams message containing the failure type, repository name, and reason
2. WHEN a failure event is detected, THE Message_Formatter SHALL include a link to the failure in Bitbucket
3. WHEN a failure event is detected, THE Message_Formatter SHALL use red color to indicate failure severity

### Requirement 5: Teams Posting

**User Story:** As a team member, I want failure notifications posted to Teams, so that I am informed of repository issues.

#### Acceptance Criteria

1. WHEN a failure message is formatted, THE Teams_Client SHALL post it to the Teams webhook URL
2. WHEN the Teams API responds with status 200 or 202, THE Teams_Client SHALL consider the post successful
3. IF the Teams API returns an error, THEN THE Teams_Client SHALL log the error and return HTTP 200 to Bitbucket

### Requirement 6: Configuration Management

**User Story:** As a DevOps engineer, I want the Lambda function to load configuration from environment variables, so that secrets and URLs are not hardcoded.

#### Acceptance Criteria

1. THE Config_Manager SHALL load the Teams webhook URL secret ARN from the `TEAMS_WEBHOOK_URL_SECRET_ARN` environment variable
2. THE Config_Manager SHALL load the Bitbucket secret ARN from the `BITBUCKET_SECRET_ARN` environment variable
3. THE Secret_Retriever SHALL retrieve the Teams webhook URL from AWS Secrets Manager using the provided ARN
4. THE Secret_Retriever SHALL retrieve the Bitbucket secret from AWS Secrets Manager using the provided ARN
5. IF a required configuration variable is missing, THEN THE Lambda_Handler SHALL fail during initialization

### Requirement 7: Error Handling and Logging

**User Story:** As a system operator, I want errors logged with context, so that I can debug issues.

#### Acceptance Criteria

1. WHEN a JSON parsing error occurs, THE Logger SHALL log it with the request ID and event type
2. WHEN an AWS service error occurs, THE Logger SHALL log it with the request ID and event type
3. WHEN a Teams API error occurs, THE Logger SHALL log it with the request ID and event type
4. WHEN a webhook is rejected, THE Logger SHALL log the reason (invalid signature, non-whitelisted IP, non-failure event)
5. WHEN logging, THE Logger SHALL redact sensitive information (signatures, tokens, secrets) from all log messages

</content>
</invoke>