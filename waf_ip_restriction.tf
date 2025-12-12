# AWS WAF v2 configuration to restrict access to Bitbucket IPs
# This provides IP-based filtering for your HTTP API

# Bitbucket IP ranges (update periodically from Atlassian documentation)
locals {
  bitbucket_ip_ranges = [
    "18.205.93.0/25",
    "18.234.32.128/25", 
    "13.52.5.0/25",
    "52.53.62.128/25",
    "13.236.8.128/25",
    "18.136.214.0/25",
    "52.215.192.128/25",
    "104.192.137.240/28",
    "104.192.138.240/28",
    "104.192.140.240/28",
    "104.192.142.240/28",
    "104.192.143.240/28",
    "185.166.143.240/28",
    "185.166.142.240/28"
  ]
}

# Create IP Set for Bitbucket addresses
resource "aws_wafv2_ip_set" "bitbucket_ips" {
  name  = "bitbucket-webhook-allowed-ips"
  scope = "REGIONAL"

  ip_address_version = "IPV4"
  addresses = local.bitbucket_ip_ranges

  tags = {
    Name        = "bitbucket-webhook-allowed-ips"
    Environment = var.environment
    Purpose     = "Bitbucket webhook IP restriction"
  }
}

# WAF Web ACL - Simple and effective
resource "aws_wafv2_web_acl" "bitbucket_webhook_acl" {
  name  = "bitbucket-webhook-acl"
  scope = "REGIONAL"

  # Default action: Block all requests
  default_action {
    block {}
  }

  # Rule: Allow only Bitbucket IPs
  rule {
    name     = "AllowBitbucketIPs"
    priority = 1

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.bitbucket_ips.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "BitbucketWebhookAllowedRequests"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "BitbucketWebhookACL"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "bitbucket-webhook-acl"
    Environment = var.environment
    Purpose     = "Restrict webhook access to Bitbucket IPs only"
  }
}

# Associate WAF with API Gateway HTTP API
resource "aws_wafv2_web_acl_association" "webhook_api_association" {
  resource_arn = aws_apigatewayv2_stage.webhook_stage.arn
  web_acl_arn  = aws_wafv2_web_acl.bitbucket_webhook_acl.arn
}

# CloudWatch Log Group for WAF logs (optional but recommended)
resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "/aws/wafv2/bitbucket-webhook-acl"
  retention_in_days = 14  # Keep logs for 2 weeks

  tags = {
    Name        = "bitbucket-webhook-waf-logs"
    Environment = var.environment
  }
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "webhook_acl_logging" {
  resource_arn            = aws_wafv2_web_acl.bitbucket_webhook_acl.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]

  # Redact sensitive headers from logs
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "x-hub-signature"
    }
  }
}

# Outputs for verification and monitoring
output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL protecting the webhook"
  value       = aws_wafv2_web_acl.bitbucket_webhook_acl.id
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.bitbucket_webhook_acl.arn
}

output "bitbucket_allowed_ip_ranges" {
  description = "IP ranges allowed by WAF (Bitbucket's current ranges)"
  value       = local.bitbucket_ip_ranges
}

output "waf_cloudwatch_dashboard_url" {
  description = "URL to view WAF metrics in CloudWatch"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#metricsV2:graph=~();search=BitbucketWebhook;namespace=AWS/WAFV2"
}