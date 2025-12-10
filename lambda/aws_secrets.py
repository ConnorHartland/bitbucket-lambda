"""AWS Secrets Manager integration."""

import boto3
import logging
from botocore.exceptions import ClientError, BotoCoreError
from typing import Dict
try:
    from .config import Configuration
except ImportError:
    from config import Configuration

logger = logging.getLogger(__name__)

# Global variables for connection pooling and secret caching
_cached_secrets: Dict[str, str] = {}
_secrets_client = None


def get_secrets_client():
    """
    Get or create a Secrets Manager client with global caching.
    
    Returns:
        boto3.client: Secrets Manager client
    """
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client('secretsmanager')
    return _secrets_client


def get_secret(secret_arn: str) -> str:
    """
    Retrieve secret from AWS Secrets Manager with caching for warm invocations.
    
    Args:
        secret_arn: The ARN of the secret to retrieve
    
    Returns:
        str: The secret value
    
    Raises:
        ValueError: If secret_arn is empty or None
        ClientError: If AWS Secrets Manager API call fails
        Exception: For other unexpected errors during secret retrieval
    """
    if not secret_arn:
        raise ValueError("Secret ARN cannot be empty or None")
    
    # Check cache first for warm invocations
    if secret_arn in _cached_secrets:
        logger.debug(f"Retrieved secret from cache: {secret_arn}")
        return _cached_secrets[secret_arn]
    
    try:
        # Get the secret from AWS Secrets Manager
        client = get_secrets_client()
        logger.info(f"Retrieving secret from Secrets Manager: {secret_arn}")
        
        response = client.get_secret_value(SecretId=secret_arn)
        
        # Extract the secret string
        secret_value = response.get('SecretString')
        if secret_value is None:
            raise ValueError(f"Secret {secret_arn} does not contain a SecretString")
        
        # Cache the secret for subsequent warm invocations
        _cached_secrets[secret_arn] = secret_value
        logger.info(f"Successfully retrieved and cached secret: {secret_arn}")
        
        return secret_value
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_message = e.response.get('Error', {}).get('Message', str(e))
        logger.error(f"AWS Secrets Manager error retrieving {secret_arn}: {error_code} - {error_message}")
        raise
    except BotoCoreError as e:
        logger.error(f"BotoCore error retrieving secret {secret_arn}: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error retrieving secret {secret_arn}: {str(e)}")
        raise


def retrieve_webhook_secret(config: Configuration) -> str:
    """
    Retrieve the Bitbucket webhook secret for signature verification.
    
    Args:
        config: Configuration object containing secret ARN
    
    Returns:
        str: The webhook secret value
    
    Raises:
        Exception: If secret retrieval fails
    """
    return get_secret(config.bitbucket_secret_arn)


def retrieve_teams_url(config: Configuration) -> str:
    """
    Retrieve the Teams Workflow URL for posting messages.
    
    Args:
        config: Configuration object containing secret ARN
    
    Returns:
        str: The Teams Workflow URL
    
    Raises:
        Exception: If secret retrieval fails
    """
    return get_secret(config.teams_webhook_url_secret_arn)