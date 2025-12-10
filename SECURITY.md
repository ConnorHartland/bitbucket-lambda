# Security Measures

This Lambda implements multiple security layers:

## 1. Webhook Secret Verification (Recommended)
- Set `BITBUCKET_WEBHOOK_SECRET` in terraform.tfvars
- Configure the same secret in Bitbucket webhook settings
- Lambda validates HMAC-SHA256 signature on every request
- Prevents unauthorized webhook calls

**Setup:**
1. Generate a strong random secret: `openssl rand -hex 32`
2. Add to terraform.tfvars: `bitbucket_webhook_secret = "your-secret"`
3. In Bitbucket webhook settings, add the same secret

## 2. IP Allowlisting
- Lambda checks source IP against Bitbucket's published IP ranges
- Rejects requests from unauthorized IPs
- IP ranges are hardcoded based on Bitbucket Cloud documentation

**Note:** Bitbucket IP ranges may change. Update `BITBUCKET_IPS` in lambda_function.py if needed.
Current ranges from: https://support.atlassian.com/bitbucket-cloud/docs/what-are-the-bitbucket-cloud-ip-addresses-i-should-use-to-configure-my-corporate-firewall/

## 3. API Gateway (No Public Listing)
- Endpoint URL is not publicly discoverable
- Only accessible if you know the exact URL
- Use security through obscurity as an additional layer (not primary)

## 4. IAM Least Privilege
- Lambda role only has CloudWatch Logs permissions
- No access to other AWS resources
- Teams webhook URL stored as encrypted environment variable

## Best Practices
- Always use webhook secret verification (layer 1)
- Rotate webhook secret periodically
- Monitor CloudWatch Logs for rejected requests
- Keep Bitbucket IP ranges updated
