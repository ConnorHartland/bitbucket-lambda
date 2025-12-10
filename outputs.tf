output "webhook_url" {
  description = "URL to configure in Bitbucket webhook settings"
  value       = "${aws_apigatewayv2_stage.webhook_stage.invoke_url}/webhook"
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.bitbucket_notifier.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.bitbucket_notifier.arn
}

output "teams_url_secret_arn" {
  description = "ARN of the Teams URL secret in Secrets Manager"
  value       = aws_secretsmanager_secret.teams_url.arn
}

output "webhook_secret_arn" {
  description = "ARN of the Bitbucket webhook secret in Secrets Manager"
  value       = aws_secretsmanager_secret.webhook_secret.arn
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_apigatewayv2_api.webhook_api.id
}

output "api_gateway_stage_name" {
  description = "Name of the API Gateway stage"
  value       = aws_apigatewayv2_stage.webhook_stage.name
}

output "lambda_log_group_name" {
  description = "Name of the Lambda CloudWatch log group"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}

output "api_gateway_log_group_name" {
  description = "Name of the API Gateway CloudWatch log group"
  value       = aws_cloudwatch_log_group.api_gateway_logs.name
}

# Monitoring Outputs

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alarm notifications"
  value       = var.enable_monitoring_alarms ? aws_sns_topic.webhook_alerts[0].arn : null
}

output "sns_topic_name" {
  description = "Name of the SNS topic for alarm notifications"
  value       = var.enable_monitoring_alarms ? aws_sns_topic.webhook_alerts[0].name : null
}

output "cloudwatch_alarms" {
  description = "List of CloudWatch alarm names created for monitoring"
  value = var.enable_monitoring_alarms ? [
    aws_cloudwatch_metric_alarm.lambda_errors[0].alarm_name,
    aws_cloudwatch_metric_alarm.lambda_error_rate[0].alarm_name,
    aws_cloudwatch_metric_alarm.lambda_duration[0].alarm_name,
    aws_cloudwatch_metric_alarm.lambda_throttles[0].alarm_name,
    aws_cloudwatch_metric_alarm.api_gateway_4xx_errors[0].alarm_name,
    aws_cloudwatch_metric_alarm.api_gateway_5xx_errors[0].alarm_name,
    aws_cloudwatch_metric_alarm.signature_verification_failures[0].alarm_name,
    aws_cloudwatch_metric_alarm.teams_api_failures[0].alarm_name,
    aws_cloudwatch_metric_alarm.unsupported_event_types[0].alarm_name
  ] : []
}

output "custom_metrics_namespace" {
  description = "CloudWatch custom metrics namespace"
  value       = "BitbucketTeamsWebhook"
}
