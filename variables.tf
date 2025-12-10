variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "teams_webhook_url" {
  description = "Microsoft Teams incoming webhook URL"
  type        = string
  sensitive   = true
}

variable "bitbucket_webhook_secret" {
  description = "Secret for verifying Bitbucket webhook signatures (optional but recommended)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "secret_recovery_window_days" {
  description = "Number of days to retain deleted secrets before permanent deletion"
  type        = number
  default     = 7
  validation {
    condition     = var.secret_recovery_window_days >= 7 && var.secret_recovery_window_days <= 30
    error_message = "Recovery window must be between 7 and 30 days."
  }
}

variable "enable_secret_rotation" {
  description = "Enable automatic secret rotation"
  type        = bool
  default     = false
}

variable "rotation_lambda_arn" {
  description = "ARN of Lambda function to perform secret rotation (required if enable_secret_rotation is true)"
  type        = string
  default     = ""
}

variable "rotation_days" {
  description = "Number of days between automatic secret rotations"
  type        = number
  default     = 90
  validation {
    condition     = var.rotation_days >= 1 && var.rotation_days <= 365
    error_message = "Rotation days must be between 1 and 365."
  }
}

variable "event_filter" {
  description = "Comma-separated list of event types to process (e.g., 'pullrequest:created,repo:push,repo:commit_status_updated')"
  type        = string
  default     = "pullrequest:created,pullrequest:fulfilled,pullrequest:rejected,repo:push,pullrequest:comment_created,repo:commit_status_updated"
}

variable "filter_mode" {
  description = "Filter mode - 'all' (process all), 'deployments' (only pipeline events), 'failures' (only failed events)"
  type        = string
  default     = "all"
  validation {
    condition     = contains(["all", "deployments", "failures"], var.filter_mode)
    error_message = "Filter mode must be one of: all, deployments, failures."
  }
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 256
  validation {
    condition     = var.lambda_memory_size >= 128 && var.lambda_memory_size <= 10240
    error_message = "Lambda memory size must be between 128 and 10240 MB."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 7
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}

variable "api_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "prod"
}

# Monitoring and Alerting Variables

variable "enable_monitoring_alarms" {
  description = "Enable CloudWatch alarms for monitoring"
  type        = bool
  default     = true
}

variable "alarm_email_endpoints" {
  description = "List of email addresses to receive alarm notifications"
  type        = list(string)
  default     = []
}

variable "lambda_error_threshold" {
  description = "Threshold for Lambda error count alarm"
  type        = number
  default     = 5
}

variable "lambda_error_rate_threshold" {
  description = "Threshold for Lambda error rate alarm (percentage as decimal, e.g., 0.05 for 5%)"
  type        = number
  default     = 0.05
  validation {
    condition     = var.lambda_error_rate_threshold >= 0 && var.lambda_error_rate_threshold <= 1
    error_message = "Lambda error rate threshold must be between 0 and 1."
  }
}

variable "lambda_duration_threshold" {
  description = "Threshold for Lambda duration alarm in milliseconds"
  type        = number
  default     = 25000
  validation {
    condition     = var.lambda_duration_threshold > 0 && var.lambda_duration_threshold <= 900000
    error_message = "Lambda duration threshold must be between 1 and 900000 milliseconds."
  }
}

variable "signature_failure_threshold" {
  description = "Threshold for signature verification failure alarm per hour"
  type        = number
  default     = 10
}

variable "teams_api_failure_threshold" {
  description = "Threshold for Teams API failure alarm"
  type        = number
  default     = 5
}

variable "api_gateway_4xx_threshold" {
  description = "Threshold for API Gateway 4XX error alarm"
  type        = number
  default     = 10
}

variable "unsupported_events_threshold" {
  description = "Threshold for unsupported event types alarm per hour"
  type        = number
  default     = 50
}
