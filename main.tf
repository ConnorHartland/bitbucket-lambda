terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Build TypeScript and package Lambda function
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_build"
  output_path = "${path.module}/lambda_function.zip"
  depends_on  = [null_resource.build_lambda]
}

# Build TypeScript to JavaScript and create deployment package
resource "null_resource" "build_lambda" {
  triggers = {
    src_hash = filebase64sha256("${path.module}/src/index.ts")
  }

  provisioner "local-exec" {
    command = "cd ${path.module} && npm run build-lambda"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "bitbucket-teams-notifier-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Attach basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# IAM policy for Secrets Manager access
resource "aws_iam_role_policy" "lambda_secrets_policy" {
  name = "bitbucket-teams-secrets-access"
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
          aws_secretsmanager_secret.teams_url.arn,
          aws_secretsmanager_secret.webhook_secret.arn
        ]
      }
    ]
  })
}

# Lambda Function
resource "aws_lambda_function" "bitbucket_notifier" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "bitbucket-teams-notifier"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "nodejs22.x"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size

  environment {
    variables = {
      TEAMS_WEBHOOK_URL_SECRET_ARN = aws_secretsmanager_secret.teams_url.arn
      BITBUCKET_SECRET_ARN         = aws_secretsmanager_secret.webhook_secret.arn
      BITBUCKET_IPS_SECRET_ARN     = aws_secretsmanager_secret.bitbucket_ips.arn
      EVENT_FILTER                 = var.event_filter
      FILTER_MODE                  = var.filter_mode
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.lambda_secrets_policy,
    aws_cloudwatch_log_group.lambda_logs,
  ]

  tags = {
    Name        = "bitbucket-teams-notifier"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "webhook_api" {
  name          = "bitbucket-webhook-api"
  protocol_type = "HTTP"
  description   = "API Gateway for Bitbucket webhook integration with Teams"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token", "x-hub-signature", "x-event-key"]
    allow_methods     = ["POST", "OPTIONS"]
    allow_origins     = ["*"]
    expose_headers    = ["date", "keep-alive"]
    max_age           = 86400
  }

  tags = {
    Name        = "bitbucket-webhook-api"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_apigatewayv2_stage" "webhook_stage" {
  api_id      = aws_apigatewayv2_api.webhook_api.id
  name        = var.api_stage_name
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      error            = "$context.error.message"
      integrationError = "$context.integration.error"
    })
  }

  tags = {
    Name        = "bitbucket-webhook-api-stage"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.webhook_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.bitbucket_notifier.invoke_arn

  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 29000 # Just under Lambda timeout

  description = "Lambda integration for Bitbucket webhook processing"
}

resource "aws_apigatewayv2_route" "webhook_route" {
  api_id    = aws_apigatewayv2_api.webhook_api.id
  route_key = "POST /webhook"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/bitbucket-webhook-api"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "bitbucket-webhook-api-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/bitbucket-teams-notifier"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "bitbucket-teams-notifier-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bitbucket_notifier.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.webhook_api.execution_arn}/*/*"
}
