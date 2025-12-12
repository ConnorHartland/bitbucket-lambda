# WAF IP Restriction Setup

## 🛡️ Overview
This setup uses AWS WAF v2 to restrict your Bitbucket webhook endpoint to only accept requests from Bitbucket's IP ranges.

## 🚀 Quick Start

### Deploy WAF Protection
```bash
terraform plan
terraform apply
```

### Verify Setup
```bash
# Check WAF is deployed
terraform output waf_web_acl_id

# View allowed IP ranges  
terraform output bitbucket_allowed_ip_ranges

# Open monitoring dashboard
terraform output waf_cloudwatch_dashboard_url
```

## 📊 Monitoring & Costs

**Monitoring**: CloudWatch metrics in `AWS/WAFV2` namespace
**Logs**: `/aws/wafv2/bitbucket-webhook-acl` log group
**Cost**: ~$1-2/month for typical usage

## 🔧 Maintenance

**Update IP ranges** when Bitbucket changes them:
1. Check: https://support.atlassian.com/bitbucket-cloud/docs/what-are-the-bitbucket-cloud-ip-addresses/
2. Edit `local.bitbucket_ip_ranges` in `waf_ip_restriction.tf`
3. Run `terraform apply`

## 🚨 Troubleshooting

**Webhooks blocked?**
- Check CloudWatch logs for blocked IPs
- Verify Bitbucket IP ranges are current
- Ensure WAF is associated with correct API Gateway stage