# IP Restriction for API Gateway HTTP API using Lambda
# Since HTTP API doesn't support WAFv2 or resource policies,
# IP filtering is implemented in the Lambda handler via environment variables

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
