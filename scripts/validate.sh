#!/bin/bash

# Bitbucket Teams Webhook Validation Script
# This script validates the pipeline configuration and dependencies

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

print_status "Validating Bitbucket Pipeline Configuration..."

# Check if bitbucket-pipelines.yml exists
if [ ! -f "bitbucket-pipelines.yml" ]; then
    print_error "bitbucket-pipelines.yml not found!"
    exit 1
fi

print_success "bitbucket-pipelines.yml found"

# Validate YAML syntax
if command -v python3 &> /dev/null; then
    print_status "Validating YAML syntax..."
    python3 -c "
import yaml
import sys
try:
    with open('bitbucket-pipelines.yml', 'r') as f:
        yaml.safe_load(f)
    print('YAML syntax is valid')
except yaml.YAMLError as e:
    print(f'YAML syntax error: {e}')
    sys.exit(1)
"
    print_success "YAML syntax validation passed"
else
    print_warning "Python3 not available, skipping YAML syntax validation"
fi

# Check required files
print_status "Checking required files..."

required_files=(
    "main.tf"
    "variables.tf"
    "outputs.tf"
    "secrets.tf"
    "terraform.tfvars.example"
    "requirements-test.txt"
    "lambda/lambda_function.py"
)

missing_files=()

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file"
    else
        print_error "✗ $file (missing)"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    print_error "Missing required files. Pipeline may fail."
    exit 1
fi

# Check test directory
print_status "Checking test structure..."
if [ -d "tests" ]; then
    test_count=$(find tests -name "test_*.py" | wc -l)
    print_success "Found $test_count test files in tests/ directory"
else
    print_error "tests/ directory not found"
    exit 1
fi

# Check if terraform.tfvars exists for deployment
if [ -f "terraform.tfvars" ]; then
    print_success "terraform.tfvars found (ready for deployment)"
else
    print_warning "terraform.tfvars not found (copy from terraform.tfvars.example for deployment)"
fi

# Validate pipeline structure
print_status "Validating pipeline structure..."

# Check if pipeline has required stages
if grep -q "validate" bitbucket-pipelines.yml && \
   grep -q "test" bitbucket-pipelines.yml && \
   grep -q "plan" bitbucket-pipelines.yml && \
   grep -q "apply" bitbucket-pipelines.yml; then
    print_success "All required pipeline stages found"
else
    print_error "Missing required pipeline stages (validate, test, plan, apply)"
    exit 1
fi

# Check for manual trigger on apply
if grep -A 5 "apply" bitbucket-pipelines.yml | grep -q "trigger: manual"; then
    print_success "Manual approval configured for apply stage"
else
    print_warning "Manual approval not found for apply stage"
fi

print_success "Pipeline validation completed successfully!"

# Show pipeline summary
print_status "Pipeline Summary:"
echo "  - Validation: Terraform fmt, validate, tflint"
echo "  - Testing: pytest with coverage (80% minimum)"
echo "  - Planning: Terraform plan with output display"
echo "  - Apply: Manual approval required for production"
echo "  - Lambda: Automatic code packaging and deployment"
echo ""
print_status "Branches configured:"
echo "  - main: Full pipeline with production deployment"
echo "  - develop: Full pipeline with development deployment"
echo "  - pull-requests: Validation and testing only"
echo "  - tags (v*): Full pipeline with production deployment"