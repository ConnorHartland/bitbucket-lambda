#!/bin/bash

# Bitbucket Teams Webhook Lambda Build Script
# Compiles TypeScript, bundles dependencies, and creates deployment package

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

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

print_status "Building Lambda function..."
print_status "Project root: $PROJECT_ROOT"

# Step 1: Clean previous build artifacts
print_status "Step 1: Cleaning previous build artifacts..."
cd "$PROJECT_ROOT"
rm -rf dist lambda_build lambda_function.zip
print_success "Cleaned build artifacts"

# Step 2: Install dependencies
print_status "Step 2: Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
    print_success "Dependencies installed"
else
    print_status "Dependencies already installed"
fi

# Step 3: Run tests
print_status "Step 3: Running tests..."
npm run test
print_success "Tests passed"

# Step 4: Compile TypeScript
print_status "Step 4: Compiling TypeScript..."
npm run build
print_success "TypeScript compiled to dist/"

# Step 5: Create Lambda build directory
print_status "Step 5: Creating Lambda build directory..."
mkdir -p lambda_build

# Step 6: Copy compiled code
print_status "Step 6: Copying compiled code..."
cp -r dist/* lambda_build/

# Step 6b: Copy package.json for dependency installation
cp package.json lambda_build/
cp package-lock.json lambda_build/

# Step 7: Copy node_modules (production dependencies only)
print_status "Step 7: Installing production dependencies..."
cd lambda_build
npm install --omit=dev
cd "$PROJECT_ROOT"
print_success "Production dependencies installed"

# Step 8: Create deployment package
print_status "Step 8: Creating deployment package..."
cd lambda_build
zip -r ../lambda_function.zip . -x "*.git*" "*.DS_Store" "node_modules/.bin/*"
cd "$PROJECT_ROOT"
print_success "Deployment package created: lambda_function.zip"

# Step 9: Verify package contents
print_status "Step 9: Verifying package contents..."
PACKAGE_SIZE=$(du -h lambda_function.zip | cut -f1)
FILE_COUNT=$(unzip -l lambda_function.zip | tail -1 | awk '{print $2}')
print_status "Package size: $PACKAGE_SIZE"
print_status "Files in package: $FILE_COUNT"

# Verify critical files are present
if unzip -l lambda_function.zip | grep -q "index.js"; then
    print_success "index.js found in package"
else
    print_error "index.js not found in package!"
    exit 1
fi

if unzip -l lambda_function.zip | grep -q "node_modules"; then
    print_success "node_modules found in package"
else
    print_error "node_modules not found in package!"
    exit 1
fi

print_success "Build completed successfully!"
print_status "Deployment package ready: $PROJECT_ROOT/lambda_function.zip"
