#!/bin/bash

# Bitbucket Teams Webhook Deployment Script
# This script mimics the pipeline steps for local development and testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    print_error "terraform.tfvars file not found!"
    print_warning "Please copy terraform.tfvars.example to terraform.tfvars and configure your values"
    exit 1
fi

# Step 1: Validate Terraform Configuration
print_status "Step 1: Validating Terraform Configuration..."

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed. Please install Terraform first."
    exit 1
fi

# Format check
print_status "Checking Terraform formatting..."
if ! terraform fmt -check -recursive; then
    print_warning "Terraform files are not properly formatted. Running terraform fmt..."
    terraform fmt -recursive
fi

# Initialize and validate
print_status "Initializing Terraform..."
terraform init

print_status "Validating Terraform configuration..."
terraform validate

# Check if tflint is available
if command -v tflint &> /dev/null; then
    print_status "Running tflint..."
    tflint --init 2>/dev/null || true
    tflint
else
    print_warning "tflint not found. Skipping linting step."
fi

print_success "Terraform validation completed successfully!"

# Step 2: Run Tests
print_status "Step 2: Running Tests..."

# Check if Python and pip are available
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Install test dependencies
print_status "Installing test dependencies..."
pip3 install -r requirements-test.txt
pip3 install pytest-cov

# Run tests with coverage
print_status "Running tests with coverage..."
python3 -m pytest tests/ --cov=lambda --cov-report=term-missing --cov-report=xml --cov-fail-under=80 -v

print_success "Tests completed successfully!"

# Step 3: Terraform Plan
print_status "Step 3: Creating Terraform Plan..."

terraform plan -out=tfplan -var-file="terraform.tfvars" -detailed-exitcode

# Show plan
print_status "Terraform Plan Summary:"
terraform show -no-color tfplan

print_success "Terraform plan created successfully!"

# Step 4: Ask for confirmation before apply
echo ""
read -p "Do you want to apply the Terraform changes? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Step 4: Applying Terraform Changes..."
    
    terraform apply -auto-approve tfplan
    
    print_status "Deployment outputs:"
    terraform output
    
    print_success "Terraform apply completed successfully!"
    
    # Step 5: Package and Deploy Lambda
    print_status "Step 5: Packaging and Deploying Lambda..."
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Create deployment package
    print_status "Creating Lambda deployment package..."
    cd lambda
    zip -r ../lambda_function.zip .
    cd ..
    
    # Get function name from Terraform output
    FUNCTION_NAME=$(terraform output -raw lambda_function_name 2>/dev/null || echo "bitbucket-teams-notifier")
    AWS_REGION=$(terraform output -raw aws_region 2>/dev/null || echo "us-east-1")
    
    # Update Lambda function code
    print_status "Updating Lambda function code..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://lambda_function.zip \
        --region "$AWS_REGION"
    
    # Wait for update to complete
    print_status "Waiting for Lambda update to complete..."
    aws lambda wait function-updated \
        --function-name "$FUNCTION_NAME" \
        --region "$AWS_REGION"
    
    print_success "Lambda deployment completed successfully!"
    
    # Show webhook URL
    WEBHOOK_URL=$(terraform output -raw webhook_url 2>/dev/null || echo "Not available")
    print_success "Deployment completed! Webhook URL: $WEBHOOK_URL"
    
else
    print_warning "Terraform apply cancelled by user."
    print_status "Plan file 'tfplan' has been created. You can apply it later with: terraform apply tfplan"
fi

print_success "Deployment script completed!"