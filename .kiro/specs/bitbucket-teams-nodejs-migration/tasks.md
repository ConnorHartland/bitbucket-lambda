# Implementation Plan: Bitbucket Teams Webhook - Node.js Migration

## Overview

This implementation plan converts the Bitbucket Teams webhook Lambda function from Python to Node.js/TypeScript. The plan follows a modular approach, implementing each component incrementally with testing at each stage. The implementation maintains all existing functionality while leveraging Node.js capabilities.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create TypeScript configuration (tsconfig.json)
  - Create package.json with dependencies (aws-sdk, fast-check for testing, jest)
  - Create directory structure for source and tests
  - Set up build and test scripts
  - _Requirements: 12.1, 12.2_

- [x] 2. Implement configuration management
  - [x] 2.1 Create Configuration class to load from environment variables
    - Load TEAMS_WEBHOOK_URL_SECRET_ARN
    - Load BITBUCKET_SECRET_ARN
    - Load EVENT_FILTER (optional)
    - Load FILTER_MODE (optional, default 'all')
    - Validate required variables and fail fast
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.2 Write property tests for Configuration
    - **Property 7: Configuration Loading from Environment**
    - **Property 8: Configuration Validation Fails Fast**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

  - [x] 2.3 Create FilterConfig class for event filtering
    - Parse EVENT_FILTER into event type list
    - Implement shouldProcess() method for all filter modes
    - Implement helper methods for deployment and failure detection
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.4 Write property tests for FilterConfig
    - **Property 11: Filter Mode 'all' Processes All Events**
    - **Property 12: Filter Mode 'deployments' Filters Correctly**
    - **Property 13: Filter Mode 'failures' Filters Correctly**
    - **Property 14: Filter Mode 'explicit' Filters Correctly**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 3. Implement signature verification
  - [x] 3.1 Create Signature Verifier module
    - Implement extractSignatureFromHeaders() to extract and parse X-Hub-Signature
    - Implement computeSignature() to compute HMAC-SHA256
    - Implement verifySignature() with constant-time comparison
    - Implement validateWebhookSignature() with minified JSON fallback
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 3.2 Write property tests for Signature Verifier
    - **Property 5: HMAC-SHA256 Signature Computation**
    - **Property 6: Signature Verification with Minified JSON**
    - **Validates: Requirements 2.1, 2.2, 2.5**

- [-] 4. Implement AWS Secrets Manager integration
  - [x] 4.1 Create Secret Retriever module
    - Implement getSecretsClient() for connection pooling
    - Implement getSecret() with caching for warm invocations
    - Implement retrieveWebhookSecret() and retrieveTeamsUrl()
    - Handle AWS service errors with logging
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 4.2 Write property tests for Secret Retriever
    - **Property 9: Secret Retrieval from AWS**
    - **Property 10: Secret Caching for Warm Invocations**
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [ ] 5. Implement event parsing
  - [ ] 5.1 Create Event Parser module with ParsedEvent interface
    - Implement parse() function to route to specific parsers
    - Implement _parsePullRequestEvent() for PR events
    - Implement _parsePushEvent() for push events
    - Implement _parseCommentEvent() for comment events
    - Implement _parseCommitStatusEvent() for commit status events
    - Return null for unsupported event types
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 5.2 Write property tests for Event Parser
    - **Property 16: Pull Request Event Parsing**
    - **Property 17: Push Event Parsing**
    - **Property 18: Comment Event Parsing**
    - **Property 19: Commit Status Event Parsing**
    - **Property 20: Unsupported Event Type Returns Null**
    - **Property 21: Malformed Payload Raises Error**
    - **Property 22: Author Email Extraction**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

- [x] 6. Implement message formatting
  - [x] 6.1 Create Message Formatter module
    - Implement getEventColor() for theme color assignment
    - Implement createMentionEntity() for author mentions
    - Implement createAdaptiveCardData() for event-specific data
    - Implement formatTeamsMessage() to create final Teams message
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 6.2 Write property tests for Message Formatter
    - **Property 23: Message Formatting Includes Required Fields**
    - **Property 24: Pull Request Message Formatting**
    - **Property 25: Push Message Formatting**
    - **Property 26: Comment Message Formatting**
    - **Property 27: Commit Status Message Formatting**
    - **Property 28: Theme Color Assignment**
    - **Property 29: Mention Entity Creation**
    - **Property 30: Null Event Formatting Raises Error**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**

- [x] 7. Implement Teams client
  - [x] 7.1 Create Teams Client module
    - Implement postToTeams() to post to Teams Workflow webhook
    - Handle HTTP status codes (200, 202 = success)
    - Implement 10-second timeout
    - Log errors with response status and body
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 7.2 Write property tests for Teams Client
    - **Property 31: Teams Posting Success**
    - **Property 32: Teams Posting Failure**
    - **Property 33: Teams Posting Headers**
    - **Property 34: Teams Posting Timeout**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6**

- [x] 8. Implement logging and metrics
  - [x] 8.1 Create Logger module
    - Implement sanitizeLogMessage() to redact sensitive data
    - Implement logWithContext() for structured logging
    - Include request ID, event type, repository in logs
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 8.2 Create Metrics module
    - Implement emitMetric() using CloudWatch EMF format
    - Implement emitEventTypeMetric() for event type tracking
    - Implement emitSignatureFailure(), emitTeamsAPIFailure(), emitUnsupportedEvent()
    - Implement emitProcessingDuration() for performance tracking
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 8.3 Write property tests for Logger and Metrics
    - **Property 42: Major Steps Logging**
    - **Property 43: Request ID in Logs**
    - **Property 44: Event Type in Logs**
    - **Property 45: Repository in Logs**
    - **Property 46: Log Sanitization**
    - **Property 47: Error Type Logging**
    - **Property 48: Metrics Emission**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**

- [x] 9. Implement webhook reception and validation
  - [x] 9.1 Create webhook reception logic
    - Extract headers and body from API Gateway event
    - Handle base64 decoding if needed
    - Extract X-Event-Key and X-Hub-Signature headers
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 9.2 Write property tests for webhook reception
    - **Property 1: Webhook Reception Extracts All Required Fields**
    - **Property 2: Base64 Decoding Round Trip**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 10. Implement error handling
  - [x] 10.1 Create error handling for all error types
    - JSON parsing errors → 400
    - Signature verification errors → 401
    - Configuration errors → 500
    - AWS service errors → 500
    - Network errors → 500
    - Unexpected errors → 500
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 10.2 Write property tests for error handling
    - **Property 3: Invalid JSON Rejected with 400**
    - **Property 4: Signature Verification Prevents Invalid Requests**
    - **Property 35: JSON Error Response**
    - **Property 36: Signature Error Response**
    - **Property 37: Configuration Error Response**
    - **Property 38: AWS Error Response**
    - **Property 39: Network Error Response**
    - **Property 40: Unexpected Error Response**
    - **Property 41: Error Logging with Context**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**

- [-] 11. Implement Lambda handler
  - [x] 11.1 Create main Lambda handler (index.ts)
    - Load configuration on module initialization
    - Implement handler() function to orchestrate pipeline
    - Extract headers and body from API Gateway event
    - Verify signature
    - Filter events
    - Parse events
    - Format messages
    - Post to Teams
    - Handle errors and return appropriate responses
    - Track processing duration
    - Emit metrics
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.5, 5.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

  - [ ]* 11.2 Write property tests for Lambda handler
    - **Property 49: Handler Signature**
    - **Property 50: Configuration Loading on Initialization**
    - **Property 51: Fail Fast on Missing Configuration**
    - **Property 52: Processing Duration Tracking**
    - **Property 53: Response Includes Context**
    - **Property 54: Success Response**
    - **Property 55: Filtered Event Response**
    - **Property 56: Unsupported Event Response**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10**

- [x] 12. Checkpoint - Ensure all tests pass
  - Run all unit tests
  - Run all property-based tests
  - Verify code coverage
  - Ask the user if questions arise

- [x] 13. Integration testing
  - [x] 13.1 Write end-to-end test for pull request created flow
    - Create realistic PR event payload
    - Generate valid signature
    - Mock AWS Secrets Manager
    - Mock Teams posting
    - Verify complete flow from webhook to Teams
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 2.1, 2.3, 3.1, 3.2, 4.1, 4.2, 5.6, 6.1, 7.1, 8.1, 12.1, 12.8_

  - [x] 13.2 Write end-to-end test for push event flow
    - Create realistic push event payload
    - Generate valid signature
    - Mock AWS Secrets Manager
    - Mock Teams posting
    - Verify complete flow from webhook to Teams
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 2.1, 2.3, 3.1, 3.2, 4.1, 4.2, 5.6, 6.2, 7.1, 8.1, 12.1, 12.8_

  - [x] 13.3 Write end-to-end test for filtered event
    - Create event that should be filtered
    - Generate valid signature
    - Mock AWS Secrets Manager
    - Verify Teams is NOT called
    - Verify 200 response with filter message
    - _Requirements: 5.5, 12.9_

  - [x] 13.4 Write end-to-end test for signature failure
    - Create event with invalid signature
    - Mock AWS Secrets Manager
    - Verify Teams is NOT called
    - Verify 401 response
    - _Requirements: 1.6, 2.3, 2.4, 12.1_

  - [x] 13.5 Write end-to-end test for Teams posting failure
    - Create valid event
    - Generate valid signature
    - Mock AWS Secrets Manager
    - Mock Teams posting to fail
    - Verify 500 response
    - _Requirements: 8.3, 8.4, 12.1_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Run all unit tests
  - Run all property-based tests
  - Run all integration tests
  - Verify code coverage
  - Ask the user if questions arise

- [x] 15. Build and prepare for deployment
  - Compile TypeScript to JavaScript
  - Create deployment package (lambda_function.zip)
  - Verify package structure
  - Document deployment steps
  - _Requirements: 12.1, 12.2_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- All tests use mocking to avoid external dependencies
