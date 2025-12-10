# AWS Secrets Manager resources for secure credential storage

# Secret for Teams Workflow URL
resource "aws_secretsmanager_secret" "teams_url" {
  name        = "bitbucket-teams/teams-url"
  description = "Microsoft Teams Workflow URL for webhook notifications"

  recovery_window_in_days = var.secret_recovery_window_days

  tags = {
    Name        = "bitbucket-teams-webhook-teams-url"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Secret version for Teams URL
resource "aws_secretsmanager_secret_version" "teams_url_version" {
  secret_id     = aws_secretsmanager_secret.teams_url.id
  secret_string = var.teams_webhook_url
}

# Secret for Bitbucket webhook signature verification
resource "aws_secretsmanager_secret" "webhook_secret" {
  name        = "bitbucket-teams/webhook-secret"
  description = "Bitbucket webhook signature verification secret"

  recovery_window_in_days = var.secret_recovery_window_days

  tags = {
    Name        = "bitbucket-teams-webhook-secret"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Secret version for Bitbucket webhook secret
resource "aws_secretsmanager_secret_version" "webhook_secret_version" {
  secret_id     = aws_secretsmanager_secret.webhook_secret.id
  secret_string = var.bitbucket_webhook_secret
}

# Optional: Secret rotation configuration for Teams URL
# Note: Rotation requires a Lambda function to perform the rotation
# This is a placeholder for future implementation
resource "aws_secretsmanager_secret_rotation" "teams_url_rotation" {
  count = var.enable_secret_rotation ? 1 : 0

  secret_id           = aws_secretsmanager_secret.teams_url.id
  rotation_lambda_arn = var.rotation_lambda_arn

  rotation_rules {
    automatically_after_days = var.rotation_days
  }
}

# Optional: Secret rotation configuration for webhook secret
resource "aws_secretsmanager_secret_rotation" "webhook_secret_rotation" {
  count = var.enable_secret_rotation ? 1 : 0

  secret_id           = aws_secretsmanager_secret.webhook_secret.id
  rotation_lambda_arn = var.rotation_lambda_arn

  rotation_rules {
    automatically_after_days = var.rotation_days
  }
}
