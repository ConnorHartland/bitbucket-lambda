"""
Property-based tests for Teams posting module.
"""
import pytest
import json
import urllib3
from hypothesis import given, strategies as st, settings
from unittest.mock import patch, MagicMock

# Import the lambda function module
import sys
sys.path.append('lambda')
from lambda_function import post_to_teams, TeamsMessageCard


# Test data generators
def teams_message_strategy():
    """Generate valid Teams MessageCard structures for testing"""
    return st.builds(
        dict,
        **{
            '@type': st.just('MessageCard'),
            '@context': st.just('https://schema.org/extensions'),
            'themeColor': st.sampled_from(['#0078D4', '#28A745', '#DC3545', '#6264A7', '#6C757D', '#FFC107']),
            'summary': st.text(min_size=1, max_size=200).filter(lambda x: len(x.strip()) > 0),
            'sections': st.lists(
                st.builds(
                    dict,
                    activityTitle=st.text(min_size=1, max_size=100).filter(lambda x: len(x.strip()) > 0),
                    activitySubtitle=st.one_of(st.none(), st.text(min_size=1, max_size=100)),
                    facts=st.lists(
                        st.builds(
                            dict,
                            name=st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
                            value=st.text(min_size=1, max_size=200).filter(lambda x: len(x.strip()) > 0)
                        ),
                        min_size=0,
                        max_size=10
                    ),
                    markdown=st.booleans()
                ),
                min_size=1,
                max_size=3
            ),
            'potentialAction': st.lists(
                st.builds(
                    dict,
                    **{
                        '@type': st.just('OpenUri'),
                        'name': st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
                        'targets': st.lists(
                            st.builds(
                                dict,
                                os=st.just('default'),
                                uri=st.just('https://bitbucket.org/example/repo')
                            ),
                            min_size=1,
                            max_size=1
                        )
                    }
                ),
                min_size=0,
                max_size=2
            )
        }
    )


def webhook_url_strategy():
    """Generate valid Teams webhook URLs"""
    return st.just('https://outlook.office.com/webhook/test-webhook-url')


# Property-based tests
@given(
    message=teams_message_strategy(),
    webhook_url=webhook_url_strategy()
)
@settings(max_examples=100)
def test_property_3_teams_posting_correctness(message, webhook_url):
    """
    **Feature: bitbucket-teams-webhook, Property 3: Teams posting correctness**
    **Validates: Requirements 1.4**
    
    For any valid Teams message card, the HTTP POST request to Teams should include 
    correct headers (Content-Type: application/json) and the message as the request body
    """
    # Mock the urllib3 PoolManager to capture the request
    with patch('lambda_function.http') as mock_http:
        # Configure mock to return successful response
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = b'1'  # Teams returns "1" for success
        mock_http.request.return_value = mock_response
        
        # Call the function
        result = post_to_teams(message, webhook_url)
        
        # Verify the function returned True (success)
        assert result is True
        
        # Verify the HTTP request was made correctly
        mock_http.request.assert_called_once()
        call_args = mock_http.request.call_args
        
        # Check method and URL
        assert call_args[0][0] == 'POST'
        assert call_args[0][1] == webhook_url
        
        # Check headers
        headers = call_args[1]['headers']
        assert headers['Content-Type'] == 'application/json'
        assert 'User-Agent' in headers
        
        # Check body is valid JSON and matches the input message
        body = call_args[1]['body']
        parsed_body = json.loads(body)
        assert parsed_body == message
        
        # Check timeout is set
        assert call_args[1]['timeout'] == 10.0


# Test error handling scenarios
@given(webhook_url=webhook_url_strategy())
@settings(max_examples=50)
def test_empty_message_handling(webhook_url):
    """Test that empty messages are handled correctly"""
    # Test with None message
    result = post_to_teams(None, webhook_url)
    assert result is False
    
    # Test with empty dict
    result = post_to_teams({}, webhook_url)
    assert result is False


@given(message=teams_message_strategy())
@settings(max_examples=50)
def test_empty_webhook_url_handling(message):
    """Test that empty webhook URLs are handled correctly"""
    # Test with None URL
    result = post_to_teams(message, None)
    assert result is False
    
    # Test with empty string URL
    result = post_to_teams(message, "")
    assert result is False


@given(
    message=teams_message_strategy(),
    webhook_url=webhook_url_strategy(),
    status_code=st.integers(min_value=400, max_value=599)
)
@settings(max_examples=50)
def test_teams_api_error_handling(message, webhook_url, status_code):
    """Test handling of Teams API errors"""
    with patch('lambda_function.http') as mock_http:
        # Configure mock to return error response
        mock_response = MagicMock()
        mock_response.status = status_code
        mock_response.data = b'Error response'
        mock_http.request.return_value = mock_response
        
        # Call the function
        result = post_to_teams(message, webhook_url)
        
        # Should return False for any non-200 status
        assert result is False


@given(
    message=teams_message_strategy(),
    webhook_url=webhook_url_strategy()
)
@settings(max_examples=50)
def test_network_exception_handling(message, webhook_url):
    """Test handling of network exceptions"""
    with patch('lambda_function.http') as mock_http:
        # Configure mock to raise an exception
        mock_http.request.side_effect = urllib3.exceptions.TimeoutError("Request timed out")
        
        # Call the function
        result = post_to_teams(message, webhook_url)
        
        # Should return False when exception occurs
        assert result is False


# Unit tests for specific scenarios
def test_successful_teams_post():
    """Test successful Teams posting with real message structure"""
    message = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "themeColor": "#0078D4",
        "summary": "Test message",
        "sections": [{
            "activityTitle": "Test Event",
            "facts": [
                {"name": "Repository", "value": "test/repo"},
                {"name": "Action", "value": "created"}
            ]
        }]
    }
    
    webhook_url = "https://outlook.office.com/webhook/test"
    
    with patch('lambda_function.http') as mock_http:
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.data = b'1'
        mock_http.request.return_value = mock_response
        
        result = post_to_teams(message, webhook_url)
        
        assert result is True
        mock_http.request.assert_called_once_with(
            'POST',
            webhook_url,
            body=json.dumps(message),
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Bitbucket-Teams-Webhook/1.0'
            },
            timeout=10.0
        )


def test_teams_error_response_logging():
    """Test that Teams error responses are properly logged"""
    message = {"@type": "MessageCard", "summary": "Test"}
    webhook_url = "https://outlook.office.com/webhook/test"
    
    with patch('lambda_function.http') as mock_http, \
         patch('lambda_function.logger') as mock_logger:
        
        mock_response = MagicMock()
        mock_response.status = 400
        mock_response.data = b'Bad Request: Invalid message format'
        mock_http.request.return_value = mock_response
        
        result = post_to_teams(message, webhook_url)
        
        assert result is False
        # Verify error was logged with status code and response body
        mock_logger.error.assert_called()
        error_call = mock_logger.error.call_args[0][0]
        assert "400" in error_call
        assert "Bad Request: Invalid message format" in error_call