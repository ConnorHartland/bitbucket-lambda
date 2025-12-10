"""
Property-based tests for secrets retrieval functionality.
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError, BotoCoreError

# Import the lambda function module
import sys
sys.path.append('lambda')
from aws_secrets import (
    get_secret,
    retrieve_webhook_secret,
    retrieve_teams_url,
    _cached_secrets
)
from config import Configuration


@given(
    secret_arn=st.text(min_size=1, max_size=200, alphabet=st.characters(min_codepoint=1, max_codepoint=127)),
    secret_value=st.text(min_size=1, max_size=500, alphabet=st.characters(min_codepoint=1, max_codepoint=127))
)
@settings(max_examples=100)
def test_property_7_secure_secret_retrieval(secret_arn, secret_value):
    """
    **Feature: bitbucket-teams-webhook, Property 7: Secure secret retrieval**
    
    For any Lambda invocation, secrets should be retrieved from AWS Secrets Manager 
    using the correct ARN and cached for subsequent warm invocations
    **Validates: Requirements 3.5**
    """
    # Clear cache before test
    _cached_aws_secrets.clear()
    
    # Mock the Secrets Manager client
    mock_client = MagicMock()
    mock_response = {
        'SecretString': secret_value,
        'ARN': secret_arn,
        'Name': 'test-secret'
    }
    mock_client.get_secret_value.return_value = mock_response
    
    with patch('lambda_function.get_secrets_client', return_value=mock_client):
        # First call should retrieve from Secrets Manager
        result1 = get_secret(secret_arn)
        
        # Verify the secret value is returned correctly
        assert result1 == secret_value
        
        # Verify Secrets Manager was called with correct ARN
        mock_client.get_secret_value.assert_called_once_with(SecretId=secret_arn)
        
        # Second call should use cache (no additional API call)
        result2 = get_secret(secret_arn)
        
        # Verify same value returned
        assert result2 == secret_value
        
        # Verify Secrets Manager was not called again (still only one call)
        assert mock_client.get_secret_value.call_count == 1
        
        # Verify secret is in cache
        assert secret_arn in _cached_secrets
        assert _cached_secrets[secret_arn] == secret_value


@given(
    teams_arn=st.text(min_size=1, max_size=200, alphabet=st.characters(min_codepoint=1, max_codepoint=127)),
    bitbucket_arn=st.text(min_size=1, max_size=200, alphabet=st.characters(min_codepoint=1, max_codepoint=127)),
    teams_url=st.text(min_size=1, max_size=500, alphabet=st.characters(min_codepoint=1, max_codepoint=127)),
    webhook_secret=st.text(min_size=1, max_size=500, alphabet=st.characters(min_codepoint=1, max_codepoint=127))
)
@settings(max_examples=100)
def test_property_18_secret_rotation_support(teams_arn, bitbucket_arn, teams_url, webhook_secret):
    """
    **Feature: bitbucket-teams-webhook, Property 18: Secret rotation support**
    
    For any secret value update in Secrets Manager, subsequent Lambda invocations 
    should retrieve and use the updated value without code deployment
    **Validates: Requirements 8.5**
    """
    # Clear cache before test
    _cached_aws_secrets.clear()
    
    # If ARNs are the same, make them different to test properly
    if teams_arn == bitbucket_arn:
        bitbucket_arn = bitbucket_arn + '_different'
    
    # Create configuration
    config = Configuration(
        teams_webhook_url_secret_arn=teams_arn,
        bitbucket_secret_arn=bitbucket_arn,
        event_filter='',
        filter_mode='all'
    )
    
    # Mock the Secrets Manager client
    mock_client = MagicMock()
    
    # Initial secret values
    initial_teams_response = {'SecretString': teams_url}
    initial_webhook_response = {'SecretString': webhook_secret}
    
    # Updated secret values (simulating rotation)
    updated_teams_url = teams_url + '_rotated'
    updated_webhook_secret = webhook_secret + '_rotated'
    updated_teams_response = {'SecretString': updated_teams_url}
    updated_webhook_response = {'SecretString': updated_webhook_secret}
    
    with patch('lambda_function.get_secrets_client', return_value=mock_client):
        # Set up responses based on ARN
        def mock_get_secret_value(SecretId):
            if SecretId == teams_arn:
                return initial_teams_response
            elif SecretId == bitbucket_arn:
                return initial_webhook_response
            else:
                raise ValueError(f"Unexpected SecretId: {SecretId}")
        
        mock_client.get_secret_value.side_effect = mock_get_secret_value
        
        # First retrieval - should get initial values
        teams_result1 = retrieve_teams_url(config)
        webhook_result1 = retrieve_webhook_secret(config)
        
        assert teams_result1 == teams_url
        assert webhook_result1 == webhook_secret
        
        # Verify secrets are cached
        assert teams_arn in _cached_secrets
        assert bitbucket_arn in _cached_secrets
        
        # Simulate secret rotation by clearing cache (new Lambda invocation)
        _cached_aws_secrets.clear()
        
        # Set up updated responses for rotated secrets
        def mock_get_secret_value_rotated(SecretId):
            if SecretId == teams_arn:
                return updated_teams_response
            elif SecretId == bitbucket_arn:
                return updated_webhook_response
            else:
                raise ValueError(f"Unexpected SecretId: {SecretId}")
        
        mock_client.get_secret_value.side_effect = mock_get_secret_value_rotated
        
        # Second retrieval after rotation - should get updated values
        teams_result2 = retrieve_teams_url(config)
        webhook_result2 = retrieve_webhook_secret(config)
        
        assert teams_result2 == updated_teams_url
        assert webhook_result2 == updated_webhook_secret
        
        # Verify new values are cached
        assert _cached_secrets[teams_arn] == updated_teams_url
        assert _cached_secrets[bitbucket_arn] == updated_webhook_secret


def test_get_secret_with_empty_arn():
    """Test that get_secret raises ValueError for empty ARN"""
    with pytest.raises(ValueError, match="Secret ARN cannot be empty or None"):
        get_secret("")
    
    with pytest.raises(ValueError, match="Secret ARN cannot be empty or None"):
        get_secret(None)


def test_get_secret_with_client_error():
    """Test that get_secret properly handles AWS ClientError"""
    secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"
    
    # Clear cache
    _cached_aws_secrets.clear()
    
    # Mock client that raises ClientError
    mock_client = MagicMock()
    error_response = {
        'Error': {
            'Code': 'ResourceNotFoundException',
            'Message': 'Secret not found'
        }
    }
    mock_client.get_secret_value.side_effect = ClientError(error_response, 'GetSecretValue')
    
    with patch('lambda_function.get_secrets_client', return_value=mock_client):
        with pytest.raises(ClientError):
            get_secret(secret_arn)


def test_get_secret_with_missing_secret_string():
    """Test that get_secret handles missing SecretString in response"""
    secret_arn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test"
    
    # Clear cache
    _cached_aws_secrets.clear()
    
    # Mock client that returns response without SecretString
    mock_client = MagicMock()
    mock_response = {
        'ARN': secret_arn,
        'Name': 'test-secret'
        # Missing SecretString
    }
    mock_client.get_secret_value.return_value = mock_response
    
    with patch('lambda_function.get_secrets_client', return_value=mock_client):
        with pytest.raises(ValueError, match="does not contain a SecretString"):
            get_secret(secret_arn)