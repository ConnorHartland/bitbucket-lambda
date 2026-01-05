# IP Restriction for API Gateway HTTP API using Lambda
# Since HTTP API doesn't support WAFv2 or resource policies,
# IP filtering is implemented in the Lambda handler via environment variables

# Bitbucket IP ranges
# These are the IP ranges that Bitbucket webhooks originate from
locals {
  bitbucket_ip_ranges = [
    "104.192.136.0/21",
    "185.166.140.0/22",
    "13.200.41.128/25"
  ]
}

# Store Bitbucket IP ranges in Secrets Manager for Lambda access
resource "aws_secretsmanager_secret" "bitbucket_ips" {
  name                    = "bitbucket-webhook-allowed-ips"
  description             = "Bitbucket IP ranges for webhook IP filtering"
  recovery_window_in_days = 7

  tags = {
    Name        = "bitbucket-webhook-allowed-ips"
    Environment = var.environment
    Purpose     = "Bitbucket webhook IP restriction"
  }
}

resource "aws_secretsmanager_secret_version" "bitbucket_ips" {
  secret_id = aws_secretsmanager_secret.bitbucket_ips.id
  secret_string = jsonencode({
    ip_ranges = local.bitbucket_ip_ranges
  })
}

# Update Lambda IAM policy to access the IP ranges secret
resource "aws_iam_role_policy" "lambda_bitbucket_ips_policy" {
  name = "bitbucket-teams-ip-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.bitbucket_ips.arn
        ]
      }
    ]
  })
}

# Outputs for verification and monitoring
output "bitbucket_allowed_ip_ranges" {
  description = "IP ranges allowed for Bitbucket webhooks"
  value       = local.bitbucket_ip_ranges
}

output "bitbucket_ips_secret_arn" {
  description = "ARN of the secret containing Bitbucket IP ranges"
  value       = aws_secretsmanager_secret.bitbucket_ips.arn
}
