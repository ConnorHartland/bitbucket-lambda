# Deployment Guide: Bitbucket Teams Webhook Lambda Function

## Overview

This document provides step-by-step instructions for deploying the Bitbucket Teams Webhook Lambda function to AWS.

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS Lambda execution role with permissions for:
  - Secrets Manager (GetSecretValue)
  - CloudWatch Logs (PutLogEvents)
  - CloudWatch Metrics (PutMetricData)
- Secrets stored in AWS Secrets Manager:
  - Teams Webhook URL
  - Bitbucket Webhook Secret

## Build Process

The deployment package is created through the following steps:

### 1. Compile TypeScript to JavaScript

```bash
npm run build
```

This command:
- Compiles all TypeScript files in `src/` to JavaScript
- Outputs compiled files to `dist/` directory
- Generates source maps and type definitions for debugging
- Runs the `prebuild` script which cleans the `dist/` directory first

### 2. Create Deployment Package

The deployment package (`lambda_function.zip`) includes:
- Compiled JavaScript files from `dist/`
- Production dependencies from `node_modules/@aws-sdk/`
- Excludes source maps (`.js.map`), type definitions (`.d.ts`), and dev dependencies

Package contents:
```
lambda_function.zip
├── lambda_build/
│   ├── index.js (Lambda handler entry point)
│   ├── config.js
│   ├── signature.js
│   ├── awsSecrets.js
│   ├── eventParser.js
│   ├── teamsFormatter.js
│   ├── teamsClient.js
│   ├── errorHandler.js
│   ├── loggingUtils.js
│   ├── metrics.js
│   ├── webhookReception.js
│   └── node_modules/
│       └── @aws-sdk/ (AWS SDK dependencies)
```

### 3. Verify Package Structure

To verify the package contents:

```bash
unzip -l lambda_function.zip | head -50
```

Expected output should show:
- All compiled `.js` files from `lambda_build/`
- AWS SDK modules in `lambda_build/node_modules/@aws-sdk/`
- No `.map` or `.d.ts` files (excluded for size optimization)

## Deployment Steps

### Step 1: Prepare AWS Environment

1. Create or update the Lambda execution role with required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

2. Store secrets in AWS Secrets Manager:

```bash
# Store Teams Webhook URL
aws secretsmanager create-secret \
  --name bitbucket-teams-webhook-url \
  --secret-string "https://outlook.webhook.office.com/webhookb2/..."

# Store Bitbucket Webhook Secret
aws secretsmanager create-secret \
  --name bitbucket-webhook-secret \
  --secret-string "your-bitbucket-secret"
```

### Step 2: Deploy Lambda Function

Using AWS CLI:

```bash
# Create Lambda function
aws lambda create-function \
  --function-name bitbucket-teams-webhook \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler lambda_build/index.handler \
  --zip-file fileb://lambda_function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{
    TEAMS_WEBHOOK_URL_SECRET_ARN=arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:bitbucket-teams-webhook-url,
    BITBUCKET_SECRET_ARN=arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:bitbucket-webhook-secret,
    FILTER_MODE=all,
    EVENT_FILTER=
  }"
```

Or update existing function:

```bash
aws lambda update-function-code \
  --function-name bitbucket-teams-webhook \
  --zip-file fileb://lambda_function.zip

aws lambda update-function-configuration \
  --function-name bitbucket-teams-webhook \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{
    TEAMS_WEBHOOK_URL_SECRET_ARN=arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:bitbucket-teams-webhook-url,
    BITBUCKET_SECRET_ARN=arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:bitbucket-webhook-secret,
    FILTER_MODE=all,
    EVENT_FILTER=
  }"
```

### Step 3: Configure API Gateway

1. Create or update API Gateway integration:

```bash
# Create API Gateway resource
aws apigateway create-resource \
  --rest-api-id API_ID \
  --parent-id PARENT_ID \
  --path-part webhook

# Create POST method
aws apigateway put-method \
  --rest-api-id API_ID \
  --resource-id RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE

# Create Lambda integration
aws apigateway put-integration \
  --rest-api-id API_ID \
  --resource-id RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:REGION:ACCOUNT_ID:function:bitbucket-teams-webhook/invocations
```

2. Grant API Gateway permission to invoke Lambda:

```bash
aws lambda add-permission \
  --function-name bitbucket-teams-webhook \
  --statement-id AllowAPIGatewayInvoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn arn:aws:execute-api:REGION:ACCOUNT_ID:API_ID/*/*
```

### Step 4: Configure Bitbucket Webhook

1. In Bitbucket repository settings, add webhook:
   - URL: `https://API_GATEWAY_URL/webhook`
   - Events: Select desired events (Push, Pull Request, etc.)
   - Secret: Use the value stored in Secrets Manager

2. Test webhook delivery in Bitbucket UI

## Environment Variables

Configure the following environment variables for the Lambda function:

| Variable | Required | Description |
|----------|----------|-------------|
| `TEAMS_WEBHOOK_URL_SECRET_ARN` | Yes | ARN of secret containing Teams Webhook URL |
| `BITBUCKET_SECRET_ARN` | Yes | ARN of secret containing Bitbucket webhook secret |
| `FILTER_MODE` | No | Event filtering mode: `all`, `deployments`, `failures`, `explicit` (default: `all`) |
| `EVENT_FILTER` | No | Comma-separated list of event types to process (used with `explicit` mode) |

## Lambda Configuration

Recommended settings:

- **Runtime**: Node.js 18.x or later
- **Memory**: 256 MB (sufficient for JSON processing and AWS SDK)
- **Timeout**: 30 seconds (sufficient for webhook processing)
- **Ephemeral Storage**: 512 MB (default)

## Monitoring and Logging

### CloudWatch Logs

Lambda logs are automatically sent to CloudWatch Logs:

```bash
# View recent logs
aws logs tail /aws/lambda/bitbucket-teams-webhook --follow
```

### CloudWatch Metrics

Custom metrics are emitted to CloudWatch:

- `EventType-{eventType}`: Count of each event type
- `SignatureVerificationFailures`: Count of signature failures
- `TeamsAPIFailures`: Count of Teams API failures
- `UnsupportedEventTypes`: Count of unsupported events
- `ProcessingDuration`: Processing time in milliseconds

View metrics in CloudWatch console or via CLI:

```bash
aws cloudwatch get-metric-statistics \
  --namespace BitbucketTeamsWebhook \
  --metric-name ProcessingDuration \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum
```

## Troubleshooting

### Common Issues

1. **Configuration Error (500)**
   - Verify environment variables are set correctly
   - Check that secrets exist in Secrets Manager
   - Verify Lambda execution role has Secrets Manager permissions

2. **Signature Verification Failed (401)**
   - Verify Bitbucket webhook secret matches the one in Secrets Manager
   - Check that webhook is using correct secret

3. **Teams API Failure (500)**
   - Verify Teams Webhook URL is correct and accessible
   - Check Teams Webhook URL hasn't expired
   - Verify network connectivity from Lambda to Teams

4. **Timeout**
   - Increase Lambda timeout setting
   - Check for network issues or slow AWS API calls

### Debug Mode

Enable detailed logging by checking CloudWatch Logs:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/bitbucket-teams-webhook \
  --filter-pattern "ERROR"
```

## Rollback

To rollback to a previous version:

```bash
# List function versions
aws lambda list-versions-by-function \
  --function-name bitbucket-teams-webhook

# Update alias to previous version
aws lambda update-alias \
  --function-name bitbucket-teams-webhook \
  --name live \
  --function-version PREVIOUS_VERSION
```

## Performance Optimization

### Cold Start Optimization

- Lambda keeps connections warm for ~15 minutes
- AWS SDK clients are reused across invocations
- Secrets are cached in module-level variables

### Package Size

Current package size: ~674 KB (compressed)

To reduce size further:
- Remove unused AWS SDK modules
- Use AWS Lambda Layers for shared dependencies

## Security Considerations

1. **Secrets Management**
   - Never store secrets in environment variables directly
   - Always use AWS Secrets Manager
   - Rotate secrets regularly

2. **Signature Verification**
   - All webhook requests are verified using HMAC-SHA256
   - Constant-time comparison prevents timing attacks
   - Invalid signatures are rejected with 401 response

3. **Logging**
   - Sensitive data (signatures, tokens) is redacted from logs
   - Request IDs are included for audit trails
   - All errors are logged with context

4. **Network Security**
   - Use VPC endpoints for Secrets Manager if needed
   - Restrict API Gateway access with WAF rules
   - Enable CloudTrail for audit logging

## Maintenance

### Regular Tasks

1. **Monitor Metrics**
   - Check processing duration trends
   - Monitor failure rates
   - Review event type distribution

2. **Update Dependencies**
   - Keep AWS SDK updated
   - Review security advisories
   - Test updates in staging environment

3. **Review Logs**
   - Check for unexpected errors
   - Monitor signature verification failures
   - Track Teams API issues

### Updating the Function

To deploy a new version:

```bash
# Rebuild package
npm run build

# Create new deployment package
# (see Build Process section)

# Update Lambda function
aws lambda update-function-code \
  --function-name bitbucket-teams-webhook \
  --zip-file fileb://lambda_function.zip
```

## Support

For issues or questions:
1. Check CloudWatch Logs for error details
2. Review this deployment guide
3. Consult AWS Lambda documentation
4. Check Bitbucket webhook documentation
