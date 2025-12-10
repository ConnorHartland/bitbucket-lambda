"""Logging utilities with sanitization and context."""

import logging
import re
from typing import List

logger = logging.getLogger(__name__)


def sanitize_log_message(message: str, sensitive_patterns: List[str] = None) -> str:
    """
    Sanitize log messages to prevent exposure of sensitive information.
    
    Args:
        message: The log message to sanitize
        sensitive_patterns: List of patterns to redact (defaults to common sensitive patterns)
    
    Returns:
        str: Sanitized log message
    """
    if sensitive_patterns is None:
        sensitive_patterns = [
            r'sha256=[a-f0-9]{64}',  # Webhook signatures
            r'Bearer [A-Za-z0-9\-._~+/]+=*',  # Bearer tokens
            r'password["\']?\s*[:=]\s*["\']?[^"\'\s]+',  # Passwords
            r'secret["\']?\s*[:=]\s*["\']?[^"\'\s]+',  # Secrets
            r'token["\']?\s*[:=]\s*["\']?[^"\'\s]+',  # Tokens
        ]
    
    sanitized = message
    for pattern in sensitive_patterns:
        sanitized = re.sub(pattern, '[REDACTED]', sanitized, flags=re.IGNORECASE)
    
    return sanitized


def log_with_context(level: int, message: str, request_id: str = None, event_type: str = None, **kwargs):
    """
    Log message with standardized context information.
    
    Args:
        level: Logging level (logging.INFO, logging.ERROR, etc.)
        message: Log message
        request_id: AWS request ID for correlation
        event_type: Bitbucket event type
        **kwargs: Additional context fields
    """
    # Build context string
    context_parts = []
    if request_id:
        context_parts.append(f"request_id={request_id}")
    if event_type:
        context_parts.append(f"event_type={event_type}")
    
    for key, value in kwargs.items():
        if value is not None:
            context_parts.append(f"{key}={value}")
    
    context_str = f"[{', '.join(context_parts)}]" if context_parts else ""
    
    # Sanitize the full message
    full_message = f"{context_str} {message}" if context_str else message
    sanitized_message = sanitize_log_message(full_message)
    
    logger.log(level, sanitized_message)