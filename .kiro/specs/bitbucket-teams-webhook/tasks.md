# Implementation Plan

- [x] 1. Set up Terraform infrastructure for secrets management
  - Create AWS Secrets Manager resources for Teams URL and Bitbucket webhook secret
  - Configure secret rotation policies
  - Add Terraform variables for secret values
  - _Requirements: 3.4, 8.1, 8.2_

- [x] 2. Update IAM role with required permissions
  - Add Secrets Manager GetSecretValue permission scoped to bitbucket-teams secrets
  - Maintain least-privilege principle
  - _Requirements: 3.4, 3.5_

- [x] 3. Implement core Lambda function structure
  - Create main handler function with API Gateway proxy event parsing
  - Implement environment variable loading and validation
  - Add fail-fast logic for missing required configuration
  - Set up global variables for connection pooling and secret caching
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 3.1 Write property test for configuration loading
  - **Property 16: Configuration retrieval on startup**
  - **Validates: Requirements 8.1, 8.2**

- [x] 3.2 Write property test for missing configuration handling
  - **Property 17: Missing configuration failure**
  - **Validates: Requirements 8.3**

- [x] 4. Implement webhook signature verification module
  - Create function to extract signature from request headers
  - Implement HMAC-SHA256 signature computation
  - Use hmac.compare_digest for constant-time comparison
  - Add signature verification logic with proper error handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4.1 Write property test for signature verification
  - **Property 4: Signature verification correctness**
  - **Validates: Requirements 2.1, 2.2**

- [x] 4.2 Write property test for invalid signature rejection
  - **Property 5: Invalid signature rejection**
  - **Validates: Requirements 2.4**

- [x] 4.3 Write property test for authenticated request processing
  - **Property 6: Authenticated request processing**
  - **Validates: Requirements 2.5**

- [x] 5. Implement secrets retrieval module
  - Create function to retrieve secrets from AWS Secrets Manager
  - Implement secret caching in global scope for warm invocations
  - Add error handling for Secrets Manager API failures
  - _Requirements: 3.5, 8.5_

- [x] 5.1 Write property test for secure secret retrieval
  - **Property 7: Secure secret retrieval**
  - **Validates: Requirements 3.5**

- [x] 5.2 Write property test for secret rotation support
  - **Property 18: Secret rotation support**
  - **Validates: Requirements 8.5**

- [x] 6. Implement event filtering module
  - Create FilterConfig class to parse filter configuration from environment variables
  - Implement should_process_event function with support for "all", "deployments", "failures" modes
  - Add logic to identify failure events (failed pipelines, declined PRs)
  - Handle explicit event type lists
  - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 6.1 Write property test for filter configuration loading
  - **Property 19: Filter configuration loading**
  - **Validates: Requirements 9.1**

- [x] 6.2 Write property test for event filter matching
  - **Property 20: Event filter matching**
  - **Validates: Requirements 9.2**

- [x] 6.3 Write property test for filtered event rejection
  - **Property 21: Filtered event rejection**
  - **Validates: Requirements 9.3**

- [x] 6.4 Write property test for failure event identification
  - **Property 22: Failure event identification**
  - **Validates: Requirements 9.5**

- [x] 7. Implement event parsing module
  - Create ParsedEvent dataclass for internal event representation
  - Implement parse_bitbucket_event function to extract fields based on event type
  - Handle pull request events (created, merged, declined, updated)
  - Handle push events with commit information
  - Handle comment events with context
  - Handle pipeline/commit status events
  - Add error handling for malformed payloads
  - _Requirements: 1.2, 4.1, 4.2, 4.3_

- [x] 7.1 Write property test for event parsing completeness
  - **Property 1: Event parsing completeness**
  - **Validates: Requirements 1.2**

- [x] 7.2 Write property test for pull request message completeness
  - **Property 8: Pull request message completeness**
  - **Validates: Requirements 4.1**

- [x] 7.3 Write property test for push event message completeness
  - **Property 9: Push event message completeness**
  - **Validates: Requirements 4.2**

- [x] 7.4 Write property test for comment event message completeness
  - **Property 10: Comment event message completeness**
  - **Validates: Requirements 4.3**

- [x] 8. Implement Teams message formatting module
  - Create TeamsMessageCard dataclass and related classes
  - Implement format_teams_message function to convert ParsedEvent to MessageCard JSON
  - Add color coding based on event type (blue for PRs, green for success, red for failures)
  - Include clickable URLs in potentialAction section
  - Format facts section with relevant event details
  - Handle unsupported event types gracefully
  - _Requirements: 1.3, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 8.1 Write property test for message card validity
  - **Property 2: Message card validity**
  - **Validates: Requirements 1.3**

- [x] 8.2 Write property test for URL inclusion
  - **Property 11: URL inclusion in messages**
  - **Validates: Requirements 4.4**

- [x] 8.3 Write property test for unsupported event handling
  - **Property 12: Unsupported event handling**
  - **Validates: Requirements 4.5**

- [x] 9. Implement Teams posting module
  - Create post_to_teams function for posting messages
  - Use urllib3 for HTTP requests with proper headers
  - Add error handling for Teams API failures
  - Return success/failure status
  - _Requirements: 1.4_

- [x] 9.1 Write property test for Teams posting correctness
  - **Property 3: Teams posting correctness**
  - **Validates: Requirements 1.4**

- [x] 10. Implement comprehensive error handling and logging
  - Add try-catch blocks for all major operations
  - Implement error logging with context (event type, request ID)
  - Add specific logging for signature verification failures (without exposing secrets)
  - Log Teams API failures with status codes
  - Implement log sanitization to prevent secret exposure
  - Map exceptions to appropriate HTTP status codes
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10.1 Write property test for error logging with context
  - **Property 13: Error logging with context**
  - **Validates: Requirements 7.1**

- [x] 10.2 Write property test for Teams failure logging
  - **Property 14: Teams failure logging**
  - **Validates: Requirements 7.3**

- [x] 10.3 Write property test for exception status code mapping
  - **Property 15: Exception status code mapping**
  - **Validates: Requirements 7.4**

- [x] 11. Wire all modules together in main handler
  - Integrate signature verification as first step
  - Add event filtering after signature verification
  - Connect event parsing, message formatting, and Teams posting
  - Ensure proper error handling throughout the flow
  - Return appropriate responses to API Gateway
  - _Requirements: 1.1, 1.5_

- [x] 11.1 Write unit tests for end-to-end flow
  - Test complete flow from webhook receipt to Teams posting
  - Test filtered events don't reach Teams
  - Test signature failures are rejected early
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 12. Update Terraform to deploy Lambda with all configurations
  - Update Lambda environment variables with filter configuration
  - Configure Lambda timeout and memory appropriately
  - Update Lambda package to include all new modules
  - Ensure API Gateway integration is properly configured
  - _Requirements: 5.1, 5.3_

- [x] 13. Create deployment pipeline configuration
  - Create bitbucket-pipelines.yml pipeline file
  - Add validation stage (terraform fmt, validate, tflint)
  - Add testing stage (pytest with coverage)
  - Add plan stage with output display
  - Add apply stage with manual approval for production
  - Add Lambda code packaging and deployment
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 14. Add CloudWatch monitoring and alarms
  - Create CloudWatch log group with retention policy
  - Add custom metrics for event types and failures
  - Create alarms for Lambda errors and Teams API failures
  - Configure alarm notifications (SNS topic)
  - _Requirements: 7.1_

- [x] 15. Create documentation and examples
  - Document environment variable configuration
  - Provide example Bitbucket webhook configuration
  - Document filter modes and event types
  - Add troubleshooting guide
  - Include example Teams message screenshots
  - _Requirements: All_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
