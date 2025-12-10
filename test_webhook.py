#!/usr/bin/env python3
import hmac
import hashlib
import json
import requests

# Configuration
webhook_url = "https://ipy0jk82zd.execute-api.us-east-1.amazonaws.com/prod/webhook"
secret = "YW1LdytIMeoMPAkf"

# Simple test payload
test_payload = {
    "repository": {
        "full_name": "connor-cicd/service-1"
    },
    "push": {
        "changes": [
            {
                "new": {
                    "name": "main"
                }
            }
        ]
    },
    "actor": {
        "display_name": "Test User"
    }
}

# Convert to JSON string (minified)
payload_json = json.dumps(test_payload, separators=(',', ':'))

# Calculate signature
def compute_signature(payload, secret):
    secret_bytes = secret.encode('utf-8')
    payload_bytes = payload.encode('utf-8')
    signature = hmac.new(secret_bytes, payload_bytes, hashlib.sha256)
    return signature.hexdigest()

signature = compute_signature(payload_json, secret)

# Prepare headers
headers = {
    'Content-Type': 'application/json',
    'X-Event-Key': 'repo:push',
    'X-Hub-Signature': f'sha256={signature}',
    'X-Hub-Signature-256': f'sha256={signature}',
    'User-Agent': 'Bitbucket-Webhooks/2.0'
}

print(f"Testing webhook with:")
print(f"URL: {webhook_url}")
print(f"Payload: {payload_json}")
print(f"Signature: sha256={signature}")
print()

# Send the request
try:
    response = requests.post(webhook_url, data=payload_json, headers=headers, timeout=30)
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"Response Body: {response.text}")
    
    if response.status_code == 200:
        print("✅ Webhook test successful!")
    else:
        print("❌ Webhook test failed!")
        
except Exception as e:
    print(f"❌ Error sending request: {e}")