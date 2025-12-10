"""Microsoft Teams client for posting messages."""

import json
import urllib3
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Global connection pool
http = urllib3.PoolManager()


def post_to_teams(event_data: Dict[str, Any], webhook_url: str) -> bool:
    """
    Post event data to Microsoft Teams Workflow.
    
    Args:
        event_data: Parsed event data for Teams Workflow template
        webhook_url: Teams Workflow webhook URL
    
    Returns:
        bool: True if posting succeeded, False otherwise
    """
    if not event_data:
        logger.error("Cannot post empty event data to Teams")
        return False
    
    if not webhook_url:
        logger.error("Teams webhook URL is required")
        return False
    
    try:
        # For Teams Workflows, we send the data directly
        # The workflow will use this data in the Adaptive Card template
        payload = event_data
        
        # Convert payload to JSON string
        payload_json = json.dumps(payload)
        
        # Prepare headers
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Bitbucket-Teams-Webhook/2.0'
        }
        
        # Extract title for logging
        title = event_data.get("title", "Unknown")
        
        logger.info(f"Posting event data to Teams: {title}")
        
        response = http.request(
            'POST',
            webhook_url,
            body=payload_json,
            headers=headers,
            timeout=10.0  # 10 second timeout
        )
        
        # Teams Workflows typically return 202 (Accepted) for successful posts
        if response.status in [200, 202]:
            logger.info("Successfully posted event data to Teams")
            return True
        else:
            # Log the error response for debugging (with status code and response body)
            error_body = response.data.decode('utf-8') if response.data else 'No response body'
            logger.error(f"Teams workflow returned status {response.status}: {error_body}")
            return False
            
    except Exception as e:
        logger.error(f"Error posting event data to Teams: {str(e)}")
        return False