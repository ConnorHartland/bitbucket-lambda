# Terraform Backend Configuration
# Store state in S3 bucket for remote state management

terraform {
  backend "s3" {
    # S3 bucket to store the state file
    bucket = "con-tfstate"
    
    # Path within the bucket to store this project's state
    key = "bitbucket-teams-webhook/terraform.tfstate"
    
    # AWS region where the S3 bucket is located
    region = "us-east-1"
    
    # Encrypt the state file at rest
    encrypt = true
    
    # Optional: Specify AWS profile if not using default
    # profile = "your-aws-profile"
    
    # Optional: Server-side encryption with AWS KMS
    # kms_key_id = "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
  }
}

# Note: Before using this backend configuration:
# 1. Create an S3 bucket for storing Terraform state
# 2. Update the bucket name above to match your actual bucket
# 3. Ensure your AWS credentials have access to the bucket
# 4. Run 'terraform init' to initialize the backend
# 5. Terraform will prompt to migrate existing state to S3