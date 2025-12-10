"""Main Lambda handler for Bitbucket Teams webhook integration."""

import json
import logging
import time
from typing import Dict, Any
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import our modules
try:
    # Try relative imports first (for Lambda deployment)
    from .config import Configuration, FilterConfig
    from .metrics import CustomMetrics
    from .logging_utils import log_with_context
    from .aws_secrets import retrieve_webhook_secret, retrieve_teams_url
    from .signature import validate_webhook_signature
    from .event_parser import parse_bitbucket_event
    from .teams_formatter import format_teams_message
    from .teams_client import post_to_teams
except ImportError:
    # Fall back to absolute imports (for testing)
    from config import Configuration, FilterConfig
    from metrics import CustomMetrics
    from logging_utils import log_with_context
    from aws_secrets import retrieve_webhook_secret, retrieve_teams_url
    from signature import validate_webhook_signature
    from event_parser import parse_bitbucket_event
    from teams_formatter import format_teams_message
    from teams_client import post_to_teams

# Load configuration on module import (fail fast)
try:
    CONFIG = Configuration.load_from_environment()
    FILTER_CONFIG = FilterConfig.from_environment(CONFIG.event_filter, CONFIG.filter_mode)
    logger.info("Configuration loaded successfully")
except ValueError as e:
    logger.error(f"Configuration loading failed: {e}")
    CONFIG = None
    FILTER_CONFIG = None


def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Main Lambda handler for processing Bitbucket webhook events.
    
    Args:
        event: API Gateway proxy event containing:
            - body: JSON string of webhook payload
            - headers: HTTP headers including X-Hub-Signature and X-Event-Key
            - requestContext: Request metadata
        context: Lambda execution context
    
    Returns:
        dict: API Gateway proxy response with statusCode and body
    """
    request_id = context.aws_request_id if context else 'unknown'
    event_type = None  # Initialize for error logging context
    start_time = time.time()  # Track processing duration
    
    try:
        log_with_context(logging.INFO, "Processing webhook request", request_id=request_id)
        
        # Fail fast if configuration is not loaded
        if CONFIG is None:
            log_with_context(logging.ERROR, "Configuration not loaded, failing fast", request_id=request_id)
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Server configuration error'})
            }
        
        # Parse API Gateway proxy event
        headers = event.get('headers', {})
        body_str = event.get('body', '{}')
        is_base64_encoded = event.get('isBase64Encoded', False)
        
        # Handle base64 encoded body if needed
        if is_base64_encoded:
            import base64
            body_str = base64.b64decode(body_str).decode('utf-8')
        
        # Extract event type from headers
        event_type = headers.get('X-Event-Key', headers.get('x-event-key', ''))
        signature = headers.get('X-Hub-Signature', headers.get('x-hub-signature', ''))
        
        log_with_context(logging.INFO, f"Received event type: {event_type}", 
                        request_id=request_id, event_type=event_type)
        
        # Debug logging for signature verification
        log_with_context(logging.INFO, f"Body length: {len(body_str)}, Base64 encoded: {is_base64_encoded}", 
                        request_id=request_id, event_type=event_type)
        
        # Emit metric for event type if valid
        if event_type:
            CustomMetrics.emit_event_type_metric(event_type)
        
        # Parse JSON payload
        try:
            body = json.loads(body_str) if body_str else {}
        except json.JSONDecodeError as e:
            log_with_context(logging.ERROR, f"Invalid JSON payload: {str(e)}", 
                           request_id=request_id, event_type=event_type, 
                           payload_size=len(body_str))
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid JSON payload'})
            }
        
        # Signature verification
        try:
            webhook_secret = retrieve_webhook_secret(CONFIG)
        except Exception as e:
            log_with_context(logging.ERROR, f"Failed to retrieve webhook secret: {str(e)}", 
                           request_id=request_id, event_type=event_type)
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Server configuration error'})
            }
        
        is_valid, error_msg = validate_webhook_signature(headers, body_str, webhook_secret)
        
        # If signature verification fails with original body, try with minified JSON
        if not is_valid:
            try:
                # Try to parse and minify the JSON
                parsed_json = json.loads(body_str)
                minified_body = json.dumps(parsed_json, separators=(',', ':'))
                is_valid, error_msg = validate_webhook_signature(headers, minified_body, webhook_secret)
                
                if is_valid:
                    log_with_context(logging.INFO, "Signature verified with minified JSON", 
                                   request_id=request_id, event_type=event_type)
                    # Use the minified body for further processing
                    body_str = minified_body
                else:
                    log_with_context(logging.WARNING, f"Signature verification failed with both original and minified JSON: {error_msg}", 
                                   request_id=request_id, event_type=event_type,
                                   has_signature=bool(signature), payload_size=len(body_str))
            except json.JSONDecodeError:
                log_with_context(logging.WARNING, f"Could not parse JSON for minification, signature verification failed: {error_msg}", 
                               request_id=request_id, event_type=event_type,
                               has_signature=bool(signature), payload_size=len(body_str))
        
        if not is_valid:
            # Emit custom metric for signature failure
            CustomMetrics.emit_signature_failure()
            
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        log_with_context(logging.INFO, "Signature verification successful", 
                        request_id=request_id, event_type=event_type)
        
        # Event filtering
        if FILTER_CONFIG is None:
            log_with_context(logging.ERROR, "Filter configuration not loaded, failing fast", 
                           request_id=request_id, event_type=event_type)
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Server configuration error'})
            }
        
        should_process = FILTER_CONFIG.should_process(event_type, body)
        if not should_process:
            log_with_context(logging.INFO, "Event filtered out by configuration", 
                           request_id=request_id, event_type=event_type,
                           filter_mode=FILTER_CONFIG.mode)
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Event filtered, not processed',
                    'event_type': event_type,
                    'request_id': request_id
                })
            }
        
        log_with_context(logging.INFO, "Event passed filter, proceeding with processing", 
                        request_id=request_id, event_type=event_type)
        
        # Event parsing
        try:
            parsed_event = parse_bitbucket_event(body, event_type)
            if parsed_event is None:
                log_with_context(logging.INFO, "Unsupported event type, returning success without processing", 
                               request_id=request_id, event_type=event_type)
                
                # Emit custom metric for unsupported event
                CustomMetrics.emit_unsupported_event()
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Unsupported event type, not processed',
                        'event_type': event_type,
                        'request_id': request_id
                    })
                }
            
            log_with_context(logging.INFO, f"Successfully parsed event for {parsed_event.repository}", 
                           request_id=request_id, event_type=event_type, 
                           repository=parsed_event.repository, action=parsed_event.action)
            
        except ValueError as e:
            log_with_context(logging.ERROR, f"Failed to parse event: {str(e)}", 
                           request_id=request_id, event_type=event_type)
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Malformed event payload'})
            }
        
        # Message formatting
        try:
            event_data = format_teams_message(parsed_event)
            log_with_context(logging.INFO, f"Successfully formatted event data", 
                           request_id=request_id, event_type=event_type,
                           event_category=parsed_event.event_category, 
                           repository=parsed_event.repository)
        except ValueError as e:
            log_with_context(logging.ERROR, f"Failed to format event data: {str(e)}", 
                           request_id=request_id, event_type=event_type,
                           repository=parsed_event.repository if parsed_event else None)
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Failed to format message'})
            }
        
        # Teams posting
        try:
            teams_url = retrieve_teams_url(CONFIG)
        except Exception as e:
            log_with_context(logging.ERROR, f"Failed to retrieve Teams URL: {str(e)}", 
                           request_id=request_id, event_type=event_type)
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Server configuration error'})
            }
        
        success = post_to_teams(event_data, teams_url)
        if not success:
            log_with_context(logging.ERROR, "Failed to post message to Teams", 
                           request_id=request_id, event_type=event_type,
                           repository=parsed_event.repository)
            
            # Emit custom metric for Teams API failure
            CustomMetrics.emit_teams_api_failure()
            
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to post to Teams'})
            }
        
        log_with_context(logging.INFO, f"Successfully posted message to Teams", 
                        request_id=request_id, event_type=event_type,
                        event_category=parsed_event.event_category, 
                        repository=parsed_event.repository)
        
        # Emit processing duration metric
        processing_duration = (time.time() - start_time) * 1000  # Convert to milliseconds
        CustomMetrics.emit_processing_duration(processing_duration)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Webhook processed and posted to Teams successfully',
                'event_type': event_type,
                'event_category': parsed_event.event_category,
                'repository': parsed_event.repository,
                'request_id': request_id,
                'processing_duration_ms': round(processing_duration, 2)
            })
        }
        
    except json.JSONDecodeError as e:
        log_with_context(logging.ERROR, f"Invalid JSON payload: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="JSONDecodeError")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON payload'})
        }
    except ValueError as e:
        # Client errors - malformed data, invalid configuration
        log_with_context(logging.ERROR, f"Client error: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="ValueError")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Bad request'})
        }
    except KeyError as e:
        # Missing required fields in payload
        log_with_context(logging.ERROR, f"Missing required field in payload: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="KeyError")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Missing required field in payload'})
        }
    except TypeError as e:
        # Type errors - usually client data issues
        log_with_context(logging.ERROR, f"Type error: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="TypeError")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid data type in payload'})
        }
    except (ConnectionError, TimeoutError) as e:
        # Network/infrastructure errors
        log_with_context(logging.ERROR, f"Network error: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type=type(e).__name__)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Service temporarily unavailable'})
        }
    except ClientError as e:
        # AWS service errors
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        log_with_context(logging.ERROR, f"AWS service error: {error_code} - {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="ClientError", aws_error_code=error_code)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Service configuration error'})
        }
    except Exception as e:
        # Catch-all for unexpected errors
        log_with_context(logging.ERROR, f"Unexpected error: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type=type(e).__name__)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }