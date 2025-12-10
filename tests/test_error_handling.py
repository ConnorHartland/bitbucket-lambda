"""
Property-based tests for error handling and logging functionality.

These tests verify that error handling meets the correctness properties
defined in the design document.
"""

import json
import logging
import pytest
from unittest.mock import Mock, patch, MagicMock
from hypothesis import given, strategies as st, settings, HealthCheck
from hypothesis.strategies import composite
import sys
import os

# Add the lambda directory to the path so we can import the module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))

from lambda_function import (
    lambda_handler,
    Configuration,
    FilterConfig,
    parse_bitbucket_event,
    post_to_teams,
    retrieve_webhook_secret,
    retrieve_teams_url
)


# Test data generators
@composite
def error_context_strategy(draw):
    """Generate error context data for testing"""
    event_types = [
        'pullrequest:created', 'pullrequest:merged', 'pullrequest:declined',
        'repo:push', 'repo:commit_status_updated', 'pullrequest:comment_created'
    ]
    
    return {
        'event_type': draw(st.sampled_from(event_types)),
        'request_id': draw(st.text(min_size=10, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc')))),
        'error_message': draw(st.text(min_size=5, max_size=200)),
        'repository': draw(st.text(min_size=5, max_size=100, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc', 'Pd')))),
    }


@composite
def teams_api_error_strategy(draw):
    """Generate Teams API error scenarios"""
    status_codes = [400, 401, 403, 404, 429, 500, 502, 503, 504]
    error_bodies = [
        '{"error": "Bad Request"}',
        '{"error": "Unauthorized"}', 
        '{"error": "Rate limited"}',
        '{"error": "Internal Server Error"}',
        'Service Unavailable',
        ''  # Empty response body
    ]
    
    return {
        'status_code': draw(st.sampled_from(status_codes)),
        'response_body': draw(st.sampled_from(error_bodies)),
        'webhook_url': draw(st.text(min_size=10, max_size=100))
    }


@composite
def exception_scenario_strategy(draw):
    """Generate different exception scenarios"""
    exception_types = [
        ValueError,
        KeyError,
        TypeError,
        ConnectionError,
        TimeoutError,
        json.JSONDecodeError
    ]
    
    exception_type = draw(st.sampled_from(exception_types))
    error_message = draw(st.text(min_size=5, max_size=100))
    
    # Handle JSONDecodeError which requires specific parameters
    if exception_type == json.JSONDecodeError:
        return {
            'exception': json.JSONDecodeError("Invalid JSON", '{"invalid": json}', 10),
            'expected_status': 400
        }
    else:
        return {
            'exception': exception_type(error_message),
            'expected_status': 500 if exception_type in [ConnectionError, TimeoutError] else 400
        }


class TestErrorLoggingProperties:
    """Property-based tests for error logging functionality"""
    
    @given(error_context=error_context_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_13_error_logging_with_context(self, error_context, caplog):
        """
        **Feature: bitbucket-teams-webhook, Property 13: Error logging with context**
        
        For any error during processing, a log entry should be created containing 
        the error message, event type, and AWS request ID.
        
        **Validates: Requirements 7.1**
        """
        # Create a mock context with request ID
        mock_context = Mock()
        mock_context.aws_request_id = error_context['request_id']
        
        # Create an API Gateway event that will cause an error
        event = {
            'headers': {
                'X-Event-Key': error_context['event_type'],
                'X-Hub-Signature': 'sha256=invalid_signature'
            },
            'body': json.dumps({
                'repository': {'full_name': error_context['repository']},
                'invalid_field': 'this will cause parsing errors'
            })
        }
        
        # Mock configuration to be loaded
        with patch('lambda_function.CONFIG') as mock_config, \
             patch('lambda_function.FILTER_CONFIG') as mock_filter_config, \
             patch('aws_secrets.retrieve_webhook_secret') as mock_secret:
            
            mock_config.teams_webhook_url_secret_arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url'
            mock_config.bitbucket_secret_arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:webhook-secret'
            mock_filter_config.should_process.return_value = True
            mock_secret.return_value = 'test_secret'
            
            # Clear any existing log records
            caplog.clear()
            
            # Call the lambda handler - this should trigger signature verification failure
            with caplog.at_level(logging.WARNING):
                response = lambda_handler(event, mock_context)
            
            # Verify that error was logged with context
            log_records = [record for record in caplog.records if record.levelno >= logging.WARNING]
            assert len(log_records) > 0, "Expected at least one warning/error log record"
            
            # Find the signature verification failure log
            signature_logs = [record for record in log_records if 'signature verification failed' in record.message.lower()]
            assert len(signature_logs) > 0, "Expected signature verification failure to be logged"
            
            signature_log = signature_logs[0]
            
            # Verify the log contains required context
            assert error_context['request_id'] in signature_log.message, f"Log should contain request ID {error_context['request_id']}"
            assert 'signature verification failed' in signature_log.message.lower(), "Log should mention signature verification failure"
            
            # Verify response indicates authentication failure
            assert response['statusCode'] == 401, "Should return 401 for signature verification failure"


class TestTeamsFailureLoggingProperties:
    """Property-based tests for Teams API failure logging"""
    
    @given(teams_error=teams_api_error_strategy())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_property_14_teams_failure_logging(self, teams_error, caplog):
        """
        **Feature: bitbucket-teams-webhook, Property 14: Teams failure logging**
        
        For any failed Teams API call, the handler should log the HTTP status code 
        and error response body.
        
        **Validates: Requirements 7.3**
        """
        # Create a mock Teams message
        teams_message = {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": "Test message",
            "sections": []
        }
        
        # Mock the HTTP response
        mock_response = Mock()
        mock_response.status = teams_error['status_code']
        mock_response.data = teams_error['response_body'].encode('utf-8') if teams_error['response_body'] else b''
        
        # Clear any existing log records
        caplog.clear()
        
        # Mock the HTTP request to return our error response
        with patch('lambda_function.http') as mock_http:
            mock_http.request.return_value = mock_response
            
            with caplog.at_level(logging.ERROR):
                result = post_to_teams(teams_message, teams_error['webhook_url'])
            
            # Verify that Teams posting failed
            assert result is False, f"Expected Teams posting to fail for status {teams_error['status_code']}"
            
            # Verify error was logged with status code and response body
            error_logs = [record for record in caplog.records if record.levelno >= logging.ERROR]
            assert len(error_logs) > 0, "Expected at least one error log record"
            
            # Find the Teams API error log
            teams_logs = [record for record in error_logs if 'teams api returned status' in record.message.lower()]
            assert len(teams_logs) > 0, "Expected Teams API error to be logged"
            
            teams_log = teams_logs[0]
            
            # Verify the log contains status code
            assert str(teams_error['status_code']) in teams_log.message, f"Log should contain status code {teams_error['status_code']}"
            
            # Verify the log contains response body (if not empty)
            if teams_error['response_body']:
                # The response body should be mentioned in the log
                assert teams_error['response_body'] in teams_log.message or 'No response body' in teams_log.message, "Log should contain response body or indicate it's empty"


class TestExceptionStatusCodeMappingProperties:
    """Property-based tests for exception to status code mapping"""
    
    @given(exception_scenario=exception_scenario_strategy())
    @settings(max_examples=100)
    def test_property_15_exception_status_code_mapping(self, exception_scenario):
        """
        **Feature: bitbucket-teams-webhook, Property 15: Exception status code mapping**
        
        For any caught exception, the handler should return an appropriate HTTP status code 
        (400 for client errors, 500 for server errors, 401 for auth failures).
        
        **Validates: Requirements 7.4**
        """
        # Create a mock context
        mock_context = Mock()
        mock_context.aws_request_id = 'test-request-id'
        
        # Create an API Gateway event
        event = {
            'headers': {
                'X-Event-Key': 'pullrequest:created',
                'X-Hub-Signature': 'sha256=valid_signature'
            },
            'body': json.dumps({
                'repository': {'full_name': 'test/repo'},
                'pullrequest': {'title': 'Test PR'}
            })
        }
        
        # Mock configuration
        with patch('lambda_function.CONFIG') as mock_config, \
             patch('lambda_function.FILTER_CONFIG') as mock_filter_config:
            
            mock_config.teams_webhook_url_secret_arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url'
            mock_config.bitbucket_secret_arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:webhook-secret'
            mock_filter_config.should_process.return_value = True
            
            # Mock the function that will raise the exception based on exception type
            exception = exception_scenario['exception']
            expected_status = exception_scenario['expected_status']
            
            if isinstance(exception, json.JSONDecodeError):
                # For JSON decode errors, mock the json.loads call
                with patch('json.loads', side_effect=exception):
                    response = lambda_handler(event, mock_context)
            elif isinstance(exception, (ConnectionError, TimeoutError)):
                # For network errors, mock the Teams posting
                with patch('aws_secrets.retrieve_webhook_secret', return_value='test_secret'), \
                     patch('signature.validate_webhook_signature', return_value=(True, None)), \
                     patch('event_parser.parse_bitbucket_event') as mock_parse, \
                     patch('teams_formatter.format_teams_message') as mock_format, \
                     patch('aws_secrets.retrieve_teams_url', return_value='https://teams.url'), \
                     patch('teams_client.post_to_teams', side_effect=exception):
                    
                    # Mock successful parsing and formatting
                    mock_parsed_event = Mock()
                    mock_parsed_event.event_category = 'pull_request'
                    mock_parsed_event.repository = 'test/repo'
                    mock_parse.return_value = mock_parsed_event
                    mock_format.return_value = {'test': 'message'}
                    
                    response = lambda_handler(event, mock_context)
            else:
                # For other exceptions, mock the parsing function
                with patch('aws_secrets.retrieve_webhook_secret', return_value='test_secret'), \
                     patch('signature.validate_webhook_signature', return_value=(True, None)), \
                     patch('event_parser.parse_bitbucket_event', side_effect=exception):
                    
                    response = lambda_handler(event, mock_context)
            
            # Verify the status code matches expected mapping
            actual_status = response['statusCode']
            
            # Verify status code mapping is correct
            if isinstance(exception, json.JSONDecodeError):
                assert actual_status == 400, f"JSON decode errors should return 400, got {actual_status}"
            elif isinstance(exception, ValueError):
                assert actual_status in [400, 500], f"ValueError should return 400 or 500, got {actual_status}"
            elif isinstance(exception, (KeyError, TypeError)):
                assert actual_status == 400, f"Client errors should return 400, got {actual_status}"
            elif isinstance(exception, (ConnectionError, TimeoutError)):
                assert actual_status == 500, f"Server errors should return 500, got {actual_status}"
            else:
                # For unexpected exceptions, should return 500
                assert actual_status == 500, f"Unexpected exceptions should return 500, got {actual_status}"
            
            # Verify response body contains error information
            response_body = json.loads(response['body'])
            assert 'error' in response_body, "Response should contain error field"
            assert isinstance(response_body['error'], str), "Error should be a string"
            assert len(response_body['error']) > 0, "Error message should not be empty"