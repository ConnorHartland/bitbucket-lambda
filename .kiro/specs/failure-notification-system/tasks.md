# Implementation Plan: Failure Notification System (Simplification)

## Overview

This implementation plan simplifies the existing Bitbucket Teams webhook system by removing unnecessary complexity. The system already has core infrastructure in place (config, secrets, IP validation, signature verification, webhook parsing, Teams formatting, and logging). This plan focuses on streamlining the logic to capture only failures and send them to Teams.

## Tasks

- [x] 1. Simplify event filtering logic
  - [x] 1.1 Review and simplify FilterConfig class
    - Remove complex filter modes (keep only 'failures' mode)
    - Focus on detecting only failure events (PR declined, build failed)
    - Remove deployment event filtering logic
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.2 Write property tests for simplified failure detection
    - **Property 6: PR Declined Detected as Failure**
    - **Property 7: Commit Status Failed Detected as Failure**
    - **Property 8: Non-Failure Events Ignored**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 2. Simplify message formatting
  - [x] 2.1 Review and simplify Teams message formatter
    - Remove Adaptive Card complexity
    - Use simple JSON structure with title, description, link, color
    - Remove mention entities and advanced formatting
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.2 Write property tests for simplified message formatting
    - **Property 10: Failure Message Contains Required Fields**
    - **Property 11: Failure Messages Use Red Color**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 3. Simplify Lambda handler orchestration
  - [x] 3.1 Review and simplify index.ts handler
    - Remove event category tracking
    - Remove metrics emission for unsupported events
    - Focus on: validate → detect failure → format → post
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 3.3, 5.1_

  - [x] 3.2 Remove unnecessary response fields
    - Simplify response body to only include essential fields
    - Remove eventCategory and other metadata

- [x] 4. Review and verify existing components
  - [x] 4.1 Verify configuration management is correct
    - Ensure config loads required ARNs
    - Verify error handling for missing config
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 4.2 Verify secret retrieval from AWS
    - Ensure secrets are cached for warm invocations
    - Verify error handling for AWS failures
    - _Requirements: 6.3, 6.4_

  - [x] 4.3 Verify IP whitelist validation
    - Ensure IP validation works correctly
    - Verify non-whitelisted IPs are rejected
    - _Requirements: 1.2, 2.5.2, 2.5.3_

  - [x] 4.4 Verify signature verification
    - Ensure HMAC-SHA256 computation is correct
    - Verify constant-time comparison is used
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.5 Verify webhook reception and parsing
    - Ensure headers and body are extracted correctly
    - Verify base64 decoding works
    - _Requirements: 1.1, 1.3, 1.5_

  - [x] 4.6 Verify logging and error handling
    - Ensure errors are logged with context
    - Verify sensitive information is sanitized
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. Write property-based tests for core components
  - [x] 5.1 Write property tests for configuration
    - **Property 14: Configuration Loading from Environment**
    - **Property 15: Configuration Validation Fails Fast**
    - **Validates: Requirements 6.1, 6.2, 6.5**

  - [x] 5.2 Write property tests for signature verification
    - **Property 3: Signature Verification Accuracy**
    - **Property 4: Invalid Signature Returns 200**
    - **Validates: Requirements 2.1, 2.2, 1.6**

  - [x] 5.3 Write property tests for IP validation
    - **Property 1: IP Whitelist Validation**
    - **Property 2: Non-Whitelisted IP Returns 200**
    - **Validates: Requirements 2.5.2, 2.5.3, 1.2**

  - [x] 5.4 Write property tests for webhook reception
    - **Property 5: Base64 Decoding Round Trip**
    - **Validates: Requirements 1.5**

  - [x] 5.5 Write property tests for Teams posting
    - **Property 12: Teams Posting Success**
    - **Property 13: Teams Posting Failure Logged**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 5.6 Write property tests for logging
    - **Property 17: JSON Error Logged**
    - **Property 18: AWS Error Logged**
    - **Property 19: Teams API Error Logged**
    - **Property 20: Log Sanitization**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all existing tests still pass
  - Ensure all new property-based tests pass
  - Verify code coverage is adequate
  - Ask the user if questions arise

- [x] 7. Clean up and remove dead code
  - [x] 7.1 Remove unused event filtering modes
    - Remove 'all', 'deployments', 'explicit' modes
    - Keep only 'failures' mode
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.2 Remove unused metrics and logging
    - Remove metrics for unsupported events
    - Remove event category tracking
    - Keep only essential logging

  - [x] 7.3 Remove unused response fields
    - Simplify response structure
    - Keep only statusCode, message, requestId, processingDurationMs

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass after cleanup
  - Verify the system is simplified and focused
  - Ask the user if questions arise

## Notes

- This plan simplifies the existing system, not rebuilds it
- All existing components are already in place
- Focus is on removing unnecessary complexity
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- The system is designed to be simple and focused on failure notification
