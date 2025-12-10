# Deployment Pipeline Documentation

This document describes the automated deployment pipeline for the Bitbucket Teams Webhook integration.

## Pipeline Overview

The deployment pipeline is configured in `bitbucket-pipelines.yml` and provides automated validation, testing, planning, and deployment of the infrastructure and Lambda function.

## Pipeline Stages

### 1. Validation Stage
- **Purpose**: Validate Terraform configuration syntax and formatting
- **Tools**: 
  - `terraform fmt -check` - Verify code formatting
  - `terraform validate` - Validate configuration syntax
  - `tflint` - Lint Terraform code for best practices
- **Triggers**: All branches and pull requests

### 2. Testing Stage
- **Purpose**: Run comprehensive test suite with coverage reporting
- **Tools**:
  - `pytest` - Run unit and property-based tests
  - `pytest-cov` - Generate coverage reports
- **Requirements**: Minimum 80% code coverage
- **Triggers**: All branches and pull requests

### 3. Planning Stage
- **Purpose**: Generate and display Terraform execution plan
- **Output**: 
  - `tfplan` - Terraform plan file
  - `plan_output.txt` - Human-readable plan summary
- **Triggers**: All branches (not pull requests)

### 4. Apply Stage
- **Purpose**: Apply infrastructure changes
- **Features**:
  - **Manual approval required** for production deployments
  - Automatic approval for development environment
  - Outputs deployment results
- **Triggers**: `main`, `develop` branches and version tags

### 5. Lambda Deployment Stage
- **Purpose**: Package and deploy Lambda function code
- **Process**:
  - Create deployment ZIP package
  - Update Lambda function code via AWS CLI
  - Wait for deployment completion
- **Triggers**: After successful infrastructure deployment

## Branch Strategy

### Main Branch (`main`)
- Full pipeline execution
- Manual approval required for production deployment
- Deploys to production environment

### Development Branch (`develop`)
- Full pipeline execution
- Automatic deployment to development environment
- No manual approval required

### Pull Requests
- Validation and testing only
- No deployment stages
- Provides feedback on proposed changes

### Version Tags (`v*`)
- Full pipeline execution
- Production deployment
- Used for release deployments

## Environment Configuration

### Required Variables

The pipeline requires the following Bitbucket repository variables to be configured:

#### AWS Configuration
- `AWS_ACCESS_KEY_ID` - AWS access key for deployment
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for deployment
- `AWS_DEFAULT_REGION` - AWS region for deployment (default: us-east-1)

#### Terraform Variables
All variables from `terraform.tfvars.example` can be set as repository variables:
- `TF_VAR_teams_webhook_url` - Microsoft Teams webhook URL
- `TF_VAR_bitbucket_webhook_secret` - Webhook signature secret
- `TF_VAR_environment` - Environment name (prod, dev, staging)
- `TF_VAR_aws_region` - AWS region
- Additional variables as needed

### Terraform Backend Configuration

For production use, configure a remote Terraform backend by creating a `backend.tf` file:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "bitbucket-teams-webhook/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

## Local Development

### Prerequisites
- Terraform >= 1.0
- Python 3.11+
- AWS CLI configured
- tflint (optional but recommended)

### Local Validation
Run the validation script to check your configuration:
```bash
./scripts/validate.sh
```

### Local Deployment
Use the deployment script for local testing:
```bash
./scripts/deploy.sh
```

This script mimics the pipeline steps and allows for local testing before pushing changes.

## Pipeline Artifacts

### Generated Artifacts
- `tfplan` - Terraform execution plan
- `plan_output.txt` - Human-readable plan summary
- `coverage.xml` - Test coverage report
- `lambda_function.zip` - Lambda deployment package
- `terraform_outputs.json` - Terraform outputs

### Artifact Retention
- Artifacts are retained for the duration of the pipeline run
- Coverage reports can be used for external reporting tools
- Terraform plans can be inspected for change review

## Monitoring and Troubleshooting

### Common Issues

#### 1. Terraform Validation Failures
- **Cause**: Syntax errors or formatting issues
- **Solution**: Run `terraform fmt` and `terraform validate` locally
- **Prevention**: Use pre-commit hooks for formatting

#### 2. Test Failures
- **Cause**: Code changes breaking existing functionality
- **Solution**: Review test output and fix failing tests
- **Prevention**: Run tests locally before pushing

#### 3. Coverage Below Threshold
- **Cause**: New code without adequate test coverage
- **Solution**: Add tests for uncovered code paths
- **Configuration**: Adjust coverage threshold in pipeline if needed

#### 4. Terraform Apply Failures
- **Cause**: AWS permissions, resource conflicts, or invalid configuration
- **Solution**: Check AWS credentials and resource state
- **Recovery**: Use `terraform import` or manual resource cleanup

#### 5. Lambda Deployment Failures
- **Cause**: Function not found, permission issues, or package size
- **Solution**: Verify function exists and AWS credentials are correct
- **Prevention**: Test Lambda deployment locally first

### Pipeline Logs
- All pipeline steps generate detailed logs
- Use Bitbucket pipeline logs for troubleshooting
- AWS CloudWatch logs available for Lambda execution issues

### Manual Intervention
If the pipeline fails and manual intervention is required:

1. **Download artifacts** from the failed pipeline run
2. **Run locally** using the deployment script
3. **Fix issues** and push corrected code
4. **Re-run pipeline** or continue from failed step

## Security Considerations

### Secrets Management
- Never commit secrets to the repository
- Use Bitbucket repository variables for sensitive data
- Mark sensitive variables as "Secured" in Bitbucket
- Rotate secrets regularly

### Access Control
- Limit who can approve production deployments
- Use branch protection rules
- Require pull request reviews for main branch
- Enable deployment environment protection

### Audit Trail
- All deployments are logged in Bitbucket
- Terraform state changes are tracked
- AWS CloudTrail logs all infrastructure changes
- Use deployment environments for approval tracking

## Performance Optimization

### Pipeline Speed
- Caching is configured for Terraform and pip dependencies
- Parallel execution where possible
- Minimal Docker image sizes
- Artifact reuse between stages

### Resource Limits
- Pipeline timeout: 30 minutes maximum
- Memory allocation: 2x for Docker services
- Concurrent builds: Limited by Bitbucket plan

## Maintenance

### Regular Tasks
- Update Terraform provider versions
- Update Python dependencies
- Review and update test coverage requirements
- Monitor pipeline performance metrics

### Version Updates
- Terraform: Update in pipeline image specification
- Python: Update in pipeline image and Lambda runtime
- Dependencies: Update in requirements-test.txt

### Pipeline Evolution
- Add new stages as needed (security scanning, performance testing)
- Integrate with external tools (Slack notifications, monitoring)
- Optimize for faster feedback cycles