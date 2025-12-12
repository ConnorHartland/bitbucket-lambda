# IP Restriction for API Gateway HTTP API using WAF
# 
# This file documents the IP restriction approach for HTTP API.
# The actual WAF configuration is in waf_ip_restriction.tf

# Note: HTTP API does NOT support resource policies like REST API
# Solution: Use AWS WAF v2 to restrict access to Bitbucket IP ranges

# The WAF configuration includes:
# ✅ IP Set with Bitbucket's current IP ranges
# ✅ Web ACL that blocks all IPs except Bitbucket
# ✅ CloudWatch logging for monitoring
# ✅ Association with your HTTP API stage

# To update Bitbucket IP ranges:
# 1. Check: https://support.atlassian.com/bitbucket-cloud/docs/what-are-the-bitbucket-cloud-ip-addresses/
# 2. Update the local.bitbucket_ip_ranges in waf_ip_restriction.tf
# 3. Run: terraform plan && terraform apply

# Monitoring:
# - View blocked requests in CloudWatch Logs: /aws/wafv2/bitbucket-webhook-acl
# - View metrics in CloudWatch: AWS/WAFV2 namespace
# - Check WAF dashboard in AWS Console

# Cost: ~$1/month for WAF Web ACL + $0.60 per million requests