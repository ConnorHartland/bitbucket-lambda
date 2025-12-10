"""Custom metrics module for CloudWatch."""

import json
import time
from typing import Dict


class CustomMetrics:
    """
    Custom metrics emission using CloudWatch Embedded Metric Format (EMF).
    This allows us to emit custom metrics directly from logs without additional API calls.
    """
    
    @staticmethod
    def emit_metric(metric_name: str, value: float = 1.0, unit: str = "Count", 
                   namespace: str = "BitbucketTeamsWebhook", dimensions: Dict[str, str] = None):
        """
        Emit a custom metric using CloudWatch Embedded Metric Format.
        
        Args:
            metric_name: Name of the metric
            value: Metric value (default 1.0 for counters)
            unit: Metric unit (Count, Milliseconds, etc.)
            namespace: CloudWatch namespace
            dimensions: Additional dimensions for the metric
        """
        if dimensions is None:
            dimensions = {}
        
        # Create EMF log entry
        emf_log = {
            "_aws": {
                "Timestamp": int(time.time() * 1000),  # Milliseconds since epoch
                "CloudWatchMetrics": [
                    {
                        "Namespace": namespace,
                        "Dimensions": [list(dimensions.keys())] if dimensions else [[]],
                        "Metrics": [
                            {
                                "Name": metric_name,
                                "Unit": unit
                            }
                        ]
                    }
                ]
            },
            metric_name: value
        }
        
        # Add dimensions to the log entry
        emf_log.update(dimensions)
        
        # Emit as structured log (CloudWatch will parse this automatically)
        print(json.dumps(emf_log))
    
    @staticmethod
    def emit_event_type_metric(event_type: str):
        """Emit metric for specific event type"""
        CustomMetrics.emit_metric(
            f"EventType-{event_type.replace(':', '-')}",
            namespace="BitbucketTeamsWebhook/EventTypes",
            dimensions={"EventType": event_type}
        )
    
    @staticmethod
    def emit_signature_failure():
        """Emit metric for signature verification failure"""
        CustomMetrics.emit_metric("SignatureVerificationFailures")
    
    @staticmethod
    def emit_teams_api_failure():
        """Emit metric for Teams API failure"""
        CustomMetrics.emit_metric("TeamsAPIFailures")
    
    @staticmethod
    def emit_unsupported_event():
        """Emit metric for unsupported event type"""
        CustomMetrics.emit_metric("UnsupportedEventTypes")
    
    @staticmethod
    def emit_processing_duration(duration_ms: float):
        """Emit metric for processing duration"""
        CustomMetrics.emit_metric(
            "ProcessingDuration",
            value=duration_ms,
            unit="Milliseconds"
        )