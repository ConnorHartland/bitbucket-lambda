"""
Property-based tests for webhook signature verification.
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import patch

# Import the lambda function module
import sys
sys.path.append('lambda')
from lambda_function import (
    extract_signature_from_headers,
    compute_signature,
    verify_signature,
    validate_webhook_signature
)


@given(
    payload=st.text(min_size=0, max_size=1000),
    secret=st.text(min_size=1, max_size=100)
)
@settings(max_examples=100)
def test_property_4_signature_verification_correctness(payload, secret):
    """
    **Feature: bitbucket-teams-webhook, Property 4: Signature verification correctness**
    
    For any request body and shared secret, the computed HMAC-SHA256 signature should 
    match Bitbucket's signature format and successfully verify authentic requests
    **Validates: Requirements 2.1, 2.2**
    """
    # Compute signature using our function
    computed_signature = compute_signature(payload, secret)
    
    # Verify the signature is a valid hex string (64 characters for SHA256)
    assert len(computed_signature) == 64
    assert all(c in '0123456789abcdef' for c in computed_signature)
    
    # Create headers in Bitbucket format
    headers = {'X-Hub-Signature': f'sha256={computed_signature}'}
    
    # Extract signature from headers
    extracted_signature = extract_signature_from_headers(headers)
    assert extracted_signature == computed_signature
    
    # Verify the signature validates correctly
    is_valid = verify_signature(payload, extracted_signature, secret)
    assert is_valid is True
    
    # Test complete validation workflow
    is_valid, error_msg = validate_webhook_signature(headers, payload, secret)
    assert is_valid is True
    assert error_msg is None


@given(
    payload=st.text(min_size=0, max_size=1000),
    secret=st.text(min_size=1, max_size=100),
    invalid_signature=st.text(min_size=1, max_size=64, alphabet='0123456789abcdef')
)
@settings(max_examples=100)
def test_property_5_invalid_signature_rejection(payload, secret, invalid_signature):
    """
    **Feature: bitbucket-teams-webhook, Property 5: Invalid signature rejection**
    
    For any webhook request with an incorrect or missing signature, the handler should 
    return 401 status code and not process the event
    **Validates: Requirements 2.4**
    """
    # Ensure invalid_signature is actually different from the correct one
    correct_signature = compute_signature(payload, secret)
    if invalid_signature == correct_signature:
        invalid_signature = 'f' + invalid_signature[1:]  # Make it different by changing first char
    
    # Test with invalid signature in headers
    headers_with_invalid = {'X-Hub-Signature': f'sha256={invalid_signature}'}
    
    # Verification should fail
    is_valid = verify_signature(payload, invalid_signature, secret)
    assert is_valid is False
    
    # Complete validation should fail with error message
    is_valid, error_msg = validate_webhook_signature(headers_with_invalid, payload, secret)
    assert is_valid is False
    assert error_msg == "Invalid signature"
    
    # Test with missing signature
    headers_no_signature = {}
    is_valid, error_msg = validate_webhook_signature(headers_no_signature, payload, secret)
    assert is_valid is False
    assert error_msg == "Missing or invalid X-Hub-Signature header"
    
    # Test with malformed signature header (no 'sha256=' prefix)
    headers_malformed = {'X-Hub-Signature': invalid_signature}
    is_valid, error_msg = validate_webhook_signature(headers_malformed, payload, secret)
    assert is_valid is False
    assert error_msg == "Missing or invalid X-Hub-Signature header"


@given(
    payload=st.text(min_size=0, max_size=1000),
    secret=st.text(min_size=1, max_size=100)
)
@settings(max_examples=100)
def test_property_6_authenticated_request_processing(payload, secret):
    """
    **Feature: bitbucket-teams-webhook, Property 6: Authenticated request processing**
    
    For any webhook request with a valid signature, event processing should proceed 
    to message formatting and Teams posting
    **Validates: Requirements 2.5**
    """
    # Generate valid signature
    correct_signature = compute_signature(payload, secret)
    headers = {'X-Hub-Signature': f'sha256={correct_signature}'}
    
    # Validation should succeed
    is_valid, error_msg = validate_webhook_signature(headers, payload, secret)
    assert is_valid is True
    assert error_msg is None
    
    # Test case-insensitive header handling (API Gateway may normalize)
    headers_lowercase = {'x-hub-signature': f'sha256={correct_signature}'}
    is_valid, error_msg = validate_webhook_signature(headers_lowercase, payload, secret)
    assert is_valid is True
    assert error_msg is None
    
    # Verify that signature extraction works with both cases
    extracted_upper = extract_signature_from_headers({'X-Hub-Signature': f'sha256={correct_signature}'})
    extracted_lower = extract_signature_from_headers({'x-hub-signature': f'sha256={correct_signature}'})
    assert extracted_upper == correct_signature
    assert extracted_lower == correct_signature