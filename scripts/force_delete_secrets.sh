#!/bin/bash

# Force delete AWS Secrets Manager secrets to allow immediate recreation
# This bypasses the 7-day recovery window

echo "Force deleting existing secrets..."

# Delete Teams URL secret
aws secretsmanager delete-secret \
    --secret-id "bitbucket-teams/teams-url" \
    --force-delete-without-recovery \
    --region us-east-1 2>/dev/null || echo "Teams URL secret not found or already deleted"

# Delete webhook secret
aws secretsmanager delete-secret \
    --secret-id "bitbucket-teams/webhook-secret" \
    --force-delete-without-recovery \
    --region us-east-1 2>/dev/null || echo "Webhook secret not found or already deleted"

echo "Secrets force deleted. You can now run 'terraform apply'"