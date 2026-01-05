# Documentation Index

This directory contains comprehensive documentation for the Bitbucket Teams Webhook integration.

## Quick Start

- **[Main README](../README.md)** - Overview, features, and quick setup guide
- **[Configuration Guide](CONFIGURATION.md)** - Detailed configuration options and environment setup
- **[Examples](EXAMPLES.md)** - Practical examples and common use cases

## Setup and Configuration

### [Configuration Guide](CONFIGURATION.md)
Complete guide to configuring the webhook integration:
- Environment variables and Terraform configuration
- Event filtering modes and options
- Multi-environment deployment strategies
- Security and performance tuning

### [Examples and Use Cases](EXAMPLES.md)
Practical examples for different scenarios:
- Development team notifications (all events)
- DevOps team notifications (deployments only)
- Management notifications (failures only)
- Multi-repository setups
- Custom message formatting

## Operations and Maintenance

### [Deployment Guide](DEPLOYMENT.md)
Automated deployment pipeline documentation:
- CI/CD pipeline configuration
- Branch strategies and approval workflows
- Environment-specific deployments
- Artifact management and rollback procedures

### [Troubleshooting Guide](TROUBLESHOOTING.md)
Comprehensive troubleshooting reference:
- Common issues and solutions
- Diagnostic commands and log analysis
- Performance optimization
- Recovery procedures

## Reference Materials

### [Security Guide](../SECURITY.md)
Security considerations and best practices:
- Webhook signature verification
- Secret management and rotation
- AWS security configuration
- Compliance and audit requirements

## Architecture and Development

### System Architecture
The integration follows a serverless architecture pattern:

```
Bitbucket → API Gateway → Lambda Function → Teams Channel
                ↓              ↓
         CloudWatch Logs  Secrets Manager
```

**Key Components**:
- **API Gateway**: HTTPS endpoint for webhook reception
- **Lambda Function**: Event processing, filtering, and Teams posting
- **Secrets Manager**: Secure storage for Teams URL and webhook secret
- **CloudWatch**: Comprehensive logging, metrics, and monitoring

### Development Workflow

1. **Local Development**:
   ```bash
   # Install dependencies
   npm install
   
   # Run tests
   npm test
   
   # Validate TypeScript
   npm run build
   
   # Lint code
   npm run lint
   ```

2. **Testing**:
   - Unit tests for individual components
   - Property-based tests for correctness validation
   - Integration tests for end-to-end workflows
   - Manual testing with curl and Postman

3. **Deployment**:
   - Automated via Bitbucket Pipelines
   - Manual deployment with AWS CLI
   - Environment-specific configurations
   - Blue-green deployment support

## Getting Started Checklist

### Prerequisites
- [ ] AWS CLI configured with appropriate permissions
- [ ] Terraform >= 1.0 installed
- [ ] Microsoft Teams channel with webhook permissions
- [ ] Bitbucket repository with admin access

### Initial Setup
- [ ] Clone repository and review documentation
- [ ] Create Teams incoming webhook and copy URL
- [ ] Configure `terraform.tfvars` with your settings
- [ ] Deploy infrastructure with `terraform apply`
- [ ] Configure Bitbucket webhook with generated URL
- [ ] Test webhook with sample event

### Verification
- [ ] Webhook endpoint responds to test requests
- [ ] Teams messages appear in configured channel
- [ ] CloudWatch logs show successful processing
- [ ] Monitoring alarms are configured and working
- [ ] Event filtering works as expected

## Support and Maintenance

### Regular Maintenance Tasks

**Weekly**:
- Review CloudWatch logs for errors or warnings
- Check alarm status and resolve any issues
- Monitor webhook delivery success rates

**Monthly**:
- Review and optimize CloudWatch log retention
- Analyze processing performance metrics
- Update dependencies and security patches

**Quarterly**:
- Rotate webhook secrets for security
- Review and update monitoring thresholds
- Assess cost optimization opportunities

### Getting Help

1. **Documentation**: Start with this documentation index
2. **Troubleshooting**: Use the [troubleshooting guide](TROUBLESHOOTING.md)
3. **Logs**: Check CloudWatch logs for detailed error information
4. **Testing**: Use manual webhook testing to isolate issues
5. **Community**: Search existing issues and discussions

### Contributing

Contributions are welcome! Please:

1. **Read the documentation** to understand the system architecture
2. **Follow the development workflow** for testing and validation
3. **Add tests** for new functionality or bug fixes
4. **Update documentation** for any changes or new features
5. **Submit pull requests** with clear descriptions and test results

## Documentation Maintenance

This documentation is maintained alongside the codebase. When making changes:

- Update relevant documentation files
- Keep examples current with code changes
- Validate all commands and code snippets
- Update version references and dependencies
- Review for clarity and completeness

For questions about the documentation or suggestions for improvements, please open an issue or submit a pull request.

## Quick Reference

### Essential Commands

```bash
# Deploy infrastructure
terraform init && terraform apply

# Check webhook status
curl -X POST "$(terraform output -raw webhook_url)" -d '{"test": true}'

# View recent logs
aws logs tail /aws/lambda/bitbucket-teams-notifier --follow

# Test Teams webhook
curl -X POST "$TEAMS_URL" -H "Content-Type: application/json" -d '{"text": "Test"}'
```

### Key Configuration Files

- `terraform.tfvars` - Main configuration
- `bitbucket-pipelines.yml` - CI/CD pipeline
- `lambda/lambda_function.py` - Core webhook logic
- `tests/` - Test suite

### Important URLs

- Webhook endpoint: `terraform output webhook_url`
- CloudWatch logs: AWS Console → CloudWatch → Log Groups
- Teams webhook: Microsoft Teams → Channel → Connectors
- Bitbucket webhook: Repository → Settings → Webhooks

This documentation provides comprehensive coverage of the Bitbucket Teams Webhook integration, from initial setup through ongoing operations and maintenance.