# Implementation Plan: Bitbucket to Teams Webhook Integration

## Overview

This implementation plan breaks down the Bitbucket to Teams webhook Lambda function into discrete coding tasks. The system will be built incrementally, starting with core infrastructure (configuration, logging, secrets), then webhook validation (IP checking, signature verification), then failure detection and formatting, and finally Teams posting. Each task builds on previous work with no orphaned code.

## Tasks

- [x] 1. Set up project structure and core types
  - Create `src/` directory structure
  - Create TypeScript interfaces for all data models (FailureEvent, Config, etc.)
  - Set up Jest and fast-check for testing
  - Create `.env.example` with required environment variables
  - _Requirements: 6.1, 6.2_

- [x] 2. Implement configuration management
  - [x] 2.1 Create Config class to load from environment
    - Load `TEAMS_WEBHOOK_URL_SECRET_ARN` and `BITBUCKET_SECRET_ARN`
    - Load `IP_RESTRICTION_ENABLED` (optional, defaults to true)
    - Validate all required variables are present
    - _Requirements: 6.1, 6.2, 6.5_

  - [x]* 2.2 Write property tests for configuration
    - **Property 14: Configuration Loading from Environment**
    - **Property 15: Configuration Validation Fails Fast**
    - **Validates: Requirements 6.1, 6.2, 6.5**

- [-] 3. Implement logging and error handling
  - [x] 3.1 Create Logger with structured logging and sanitization
    - Implement log levels (info, warn, error)
    - Sanitize signatures, tokens, and secrets from all logs
    - Include request ID and event type in context
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 3.2 Write property tests for logging
    - **Property 17: JSON Error Logged**
    - **Property 18: AWS Error Logged**
    - **Property 19: Teams API Error Logged**
    - **Property 20: Log Sanitization**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

- [-] 4. Implement secrets management
  - [x] 4.1 Create Secret Retriever to fetch from AWS Secrets Manager
    - Implement caching for warm Lambda invocations
    - Handle AWS errors gracefully
    - _Requirements: 6.3, 6.4_

  - [ ]* 4.2 Write property tests for secret retrieval
    - **Property 16: Secret Retrieval from AWS**
    - **Validates: Requirements 6.3, 6.4**

- [x] 5. Implement webhook reception and parsing
  - [x] 5.1 Create webhook reception handler
    - Extract event type from `X-Event-Key` header
    - Extract signature from `X-Hub-Signature` header
    - Handle base64 encoded request bodies
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 5.2 Write property tests for webhook reception
    - **Property 5: Base64 Decoding Round Trip**
    - **Validates: Requirements 1.3**

- [-] 6. Implement IP whitelist validation
  - [x] 6.1 Create IP Whitelist Checker
    - Extract source IP from `X-Forwarded-For` header or event context
    - Maintain list of Bitbucket IP ranges
    - Check if source IP is whitelisted
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 6.2 Write property tests for IP validation
    - **Property 1: IP Whitelist Validation**
    - **Property 2: Non-Whitelisted IP Returns 200**
    - **Property 22: Source IP Extraction**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 7. Implement signature verification
  - [x] 7.1 Create Signature Verifier
    - Implement HMAC-SHA256 verification
    - Use constant-time comparison
    - Parse signature format `sha256=<hex_encoded_hmac>`
    - _Requirements: 1.4, 2.1_

  - [ ]* 7.2 Write property tests for signature verification
    - **Property 3: Signature Verification Accuracy**
    - **Property 4: Invalid Signature Returns 200**
    - **Validates: Requirements 1.4, 1.5, 1.6, 2.1**

- [x] 8. Implement failure detection
  - [x] 8.1 Create Failure Detector
    - Detect `pullrequest:rejected` events
    - Detect `repo:commit_status_updated` events with state='failed'
    - Extract repository, author, reason, and link from each event type
    - Return null for non-failure events
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 8.2 Write property tests for failure detection
    - **Property 6: PR Rejected Detected as Failure**
    - **Property 7: Commit Status Failed Detected as Failure**
    - **Property 8: Non-Failure Events Ignored**
    - **Property 9: Failure Details Extracted**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [-] 9. Implement message formatting
  - [x] 9.1 Create Message Formatter
    - Format failure events into Teams message JSON
    - Include failure type, repository, reason, and link
    - Use red color for all failure messages
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 9.2 Write property tests for message formatting
    - **Property 10: Failure Message Contains Required Fields**
    - **Property 11: Failure Messages Use Red Color**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [-] 10. Implement Teams client
  - [x] 10.1 Create Teams Client
    - Post messages to Teams webhook URL
    - Handle HTTP status 200 and 202 as success
    - Log errors for failed posts
    - _Requirements: 5.1, 5.2, 5.3_

  - [x]* 10.2 Write property tests for Teams posting
    - **Property 12: Teams Posting Success**
    - **Property 13: Teams Posting Failure Logged**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 11. Implement Lambda handler orchestration
  - [x] 11.1 Create Lambda handler
    - Load configuration
    - Extract headers and body from event
    - Check IP whitelist (if enabled)
    - Verify signature
    - Load secrets
    - Detect failure
    - Format and post to Teams if failure
    - Return 200 OK for all outcomes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all unit tests pass
  - Ensure all property-based tests pass (minimum 100 iterations each)
  - Verify code coverage is adequate
  - Ask the user if questions arise

- [x] 13. Build and package Lambda function
  - [x] 13.1 Create build script
    - Compile TypeScript to JavaScript
    - Bundle dependencies
    - Create deployment package
    - _Requirements: All_

  - [x] 13.2 Update Terraform configuration
    - Reference the built Lambda package
    - Ensure environment variables are set
    - Verify IAM role has required permissions
    - _Requirements: All_

- [-] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass after build
  - Verify the system is complete and focused
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All code is written in TypeScript for Node.js 22
- The system is designed to be simple and focused on failure notification

