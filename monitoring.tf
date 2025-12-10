# CloudWatch Monitoring and Alarms for Bitbucket Teams Webhook

# SNS Topic for alarm notifications
resource "aws_sns_topic" "webhook_alerts" {
  count = var.enable_monitoring_alarms ? 1 : 0
  name  = "bitbucket-teams-webhook-alerts"

  tags = {
    Name        = "bitbucket-teams-webhook-alerts"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# SNS Topic Subscriptions for email notifications
resource "aws_sns_topic_subscription" "webhook_alerts_email" {
  count     = var.enable_monitoring_alarms ? length(var.alarm_email_endpoints) : 0
  topic_arn = aws_sns_topic.webhook_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email_endpoints[count.index]
}

# SNS Topic Policy to allow CloudWatch to publish
resource "aws_sns_topic_policy" "webhook_alerts_policy" {
  count = var.enable_monitoring_alarms ? 1 : 0
  arn   = aws_sns_topic.webhook_alerts[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchAlarmsToPublish"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.webhook_alerts[0].arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}

# CloudWatch Alarm: Lambda Function Errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300" # 5 minutes
  statistic           = "Sum"
  threshold           = var.lambda_error_threshold
  alarm_description   = "This metric monitors Lambda function errors"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.bitbucket_notifier.function_name
  }

  tags = {
    Name        = "bitbucket-teams-lambda-errors"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Alarm: Lambda Function Error Rate
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-lambda-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  threshold           = var.lambda_error_rate_threshold
  alarm_description   = "This metric monitors Lambda function error rate"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    return_data = false

    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"

      dimensions = {
        FunctionName = aws_lambda_function.bitbucket_notifier.function_name
      }
    }
  }

  metric_query {
    id          = "invocation_count"
    return_data = false

    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"

      dimensions = {
        FunctionName = aws_lambda_function.bitbucket_notifier.function_name
      }
    }
  }

  metric_query {
    id          = "error_rate_calculation"
    expression  = "error_rate / invocation_count"
    label       = "Error Rate"
    return_data = true
  }

  tags = {
    Name        = "bitbucket-teams-lambda-error-rate"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Alarm: Lambda Function Duration (approaching timeout)
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = var.lambda_duration_threshold
  alarm_description   = "This metric monitors Lambda function duration approaching timeout"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.bitbucket_notifier.function_name
  }

  tags = {
    Name        = "bitbucket-teams-lambda-duration"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Alarm: Lambda Function Throttles
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors Lambda function throttles"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.bitbucket_notifier.function_name
  }

  tags = {
    Name        = "bitbucket-teams-lambda-throttles"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Alarm: API Gateway 4XX Errors
resource "aws_cloudwatch_metric_alarm" "api_gateway_4xx_errors" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGatewayV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.api_gateway_4xx_threshold
  alarm_description   = "This metric monitors API Gateway 4XX errors (client errors)"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = aws_apigatewayv2_api.webhook_api.id
    Stage = aws_apigatewayv2_stage.webhook_stage.name
  }

  tags = {
    Name        = "bitbucket-teams-api-4xx-errors"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Alarm: API Gateway 5XX Errors
resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx_errors" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGatewayV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors API Gateway 5XX errors (server errors)"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = aws_apigatewayv2_api.webhook_api.id
    Stage = aws_apigatewayv2_stage.webhook_stage.name
  }

  tags = {
    Name        = "bitbucket-teams-api-5xx-errors"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Log Metric Filter: Signature Verification Failures
resource "aws_cloudwatch_log_metric_filter" "signature_verification_failures" {
  name           = "SignatureVerificationFailures"
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  pattern        = "[timestamp, request_id, level=\"WARN\", message=\"*signature*\"]"

  metric_transformation {
    name      = "SignatureVerificationFailures"
    namespace = "BitbucketTeamsWebhook"
    value     = "1"

    default_value = 0
  }
}

# CloudWatch Alarm: Signature Verification Failures
resource "aws_cloudwatch_metric_alarm" "signature_verification_failures" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-signature-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "SignatureVerificationFailures"
  namespace           = "BitbucketTeamsWebhook"
  period              = "3600" # 1 hour
  statistic           = "Sum"
  threshold           = var.signature_failure_threshold
  alarm_description   = "This metric monitors signature verification failures indicating potential security issues"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name        = "bitbucket-teams-signature-failures"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Log Metric Filter: Teams API Failures
resource "aws_cloudwatch_log_metric_filter" "teams_api_failures" {
  name           = "TeamsAPIFailures"
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  pattern        = "[timestamp, request_id, level=\"ERROR\", message=\"*Teams*\"]"

  metric_transformation {
    name      = "TeamsAPIFailures"
    namespace = "BitbucketTeamsWebhook"
    value     = "1"

    default_value = 0
  }
}

# CloudWatch Alarm: Teams API Failures
resource "aws_cloudwatch_metric_alarm" "teams_api_failures" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-api-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TeamsAPIFailures"
  namespace           = "BitbucketTeamsWebhook"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.teams_api_failure_threshold
  alarm_description   = "This metric monitors Teams API failures indicating connectivity or authentication issues"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name        = "bitbucket-teams-api-failures"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Log Metric Filter: Event Types
resource "aws_cloudwatch_log_metric_filter" "event_types" {
  for_each = toset([
    "pullrequest:created",
    "pullrequest:fulfilled",
    "pullrequest:rejected",
    "repo:push",
    "pullrequest:comment_created",
    "repo:commit_status_updated"
  ])

  name           = "EventType-${replace(each.value, ":", "-")}"
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  pattern        = "[timestamp, request_id, level, event_type=\"${each.value}\", ...]"

  metric_transformation {
    name      = "EventType-${replace(each.value, ":", "-")}"
    namespace = "BitbucketTeamsWebhook/EventTypes"
    value     = "1"

    default_value = 0
  }
}

# CloudWatch Log Metric Filter: Unsupported Event Types
resource "aws_cloudwatch_log_metric_filter" "unsupported_event_types" {
  name           = "UnsupportedEventTypes"
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  pattern        = "[timestamp, request_id, level, message=\"*unsupported*event*type*\"]"

  metric_transformation {
    name      = "UnsupportedEventTypes"
    namespace = "BitbucketTeamsWebhook"
    value     = "1"

    default_value = 0
  }
}

# CloudWatch Alarm: High Unsupported Event Types
resource "aws_cloudwatch_metric_alarm" "unsupported_event_types" {
  count               = var.enable_monitoring_alarms ? 1 : 0
  alarm_name          = "bitbucket-teams-unsupported-events"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UnsupportedEventTypes"
  namespace           = "BitbucketTeamsWebhook"
  period              = "3600" # 1 hour
  statistic           = "Sum"
  threshold           = var.unsupported_events_threshold
  alarm_description   = "This metric monitors high numbers of unsupported event types indicating potential configuration issues"
  alarm_actions       = [aws_sns_topic.webhook_alerts[0].arn]
  ok_actions          = [aws_sns_topic.webhook_alerts[0].arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name        = "bitbucket-teams-unsupported-events"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}