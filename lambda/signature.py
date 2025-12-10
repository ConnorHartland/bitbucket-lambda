"""Webhook signature verification."""

import hmac
import hashlib
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)


def extract_signature_from_headers(headers: Dict[str, str]) -> Optional[str]:
    """
    Extract signature from request headers.
    
    Args:
        headers: HTTP headers dictionary (case-insensitive)
    
    Returns:
        str: The signature value without the 'sha256=' prefix, or None if not found
    """
    # Check both cases since API Gateway may normalize headers
    signature_header = headers.get('X-Hub-Signature', headers.get('x-hub-signature', ''))
    
    if not signature_header:
        return None
    
    # Bitbucket sends signatures in format 'sha256=<hex_digest>'
    if signature_header.startswith('sha256='):
        return signature_header[7:]  # Remove 'sha256=' prefix
    
    return None


def compute_signature(payload: str, secret: str) -> str:
    """
    Compute HMAC-SHA256 signature for the given payload and secret.
    
    Args:
        payload: The request body as a string
        secret: The shared secret for signature computation
    
    Returns:
        str: Hex digest of the HMAC-SHA256 signature
    """
    # Convert strings to bytes for HMAC computation
    secret_bytes = secret.encode('utf-8')
    payload_bytes = payload.encode('utf-8')
    
    # Compute HMAC-SHA256
    signature = hmac.new(secret_bytes, payload_bytes, hashlib.sha256)
    return signature.hexdigest()


def verify_signature(payload: str, received_signature: str, secret: str) -> bool:
    """
    Verify webhook signature using constant-time comparison.
    
    Args:
        payload: The request body as a string
        received_signature: The signature from the request header (without 'sha256=' prefix)
        secret: The shared secret for verification
    
    Returns:
        bool: True if signature is valid, False otherwise
    """
    if not received_signature or not secret:
        return False
    
    # Compute expected signature
    expected_signature = compute_signature(payload, secret)
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, received_signature)


def validate_webhook_signature(headers: Dict[str, str], body: str, secret: str) -> Tuple[bool, Optional[str]]:
    """
    Complete signature validation workflow with error handling.
    
    Args:
        headers: HTTP headers dictionary
        body: Request body as string
        secret: Webhook secret for verification
    
    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)
            - is_valid: True if signature is valid
            - error_message: Error description if validation fails, None if successful
    """
    try:
        # Extract signature from headers
        signature = extract_signature_from_headers(headers)
        if signature is None:
            return False, "Missing or invalid X-Hub-Signature header"
        
        # Verify signature
        is_valid = verify_signature(body, signature, secret)
        if not is_valid:
            return False, "Invalid signature"
        
        return True, None
        
    except Exception as e:
        logger.error(f"Signature validation error: {str(e)}")
        return False, f"Signature validation failed: {str(e)}"