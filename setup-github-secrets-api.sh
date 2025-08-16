#!/bin/bash

# This script sets up GitHub secrets using the GitHub API
# You need to provide a GitHub Personal Access Token with repo scope

echo "Please enter your GitHub Personal Access Token (with 'repo' scope):"
echo "You can create one at: https://github.com/settings/tokens/new"
read -s GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GitHub token is required"
    exit 1
fi

OWNER="gongiskhan"
REPO="claudecodeui"
API_URL="https://api.github.com"

# Function to create/update a secret
create_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    echo "Setting secret: $SECRET_NAME"
    
    # Get the repository public key
    PUB_KEY_RESPONSE=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "$API_URL/repos/$OWNER/$REPO/actions/secrets/public-key")
    
    KEY_ID=$(echo $PUB_KEY_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['key_id'])")
    PUBLIC_KEY=$(echo $PUB_KEY_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['key'])")
    
    # Encrypt the secret value using Python
    ENCRYPTED_VALUE=$(python3 -c "
import base64
from nacl import encoding, public

public_key = public.PublicKey('$PUBLIC_KEY', encoding.Base64Encoder())
sealed_box = public.SealedBox(public_key)
encrypted = sealed_box.encrypt('$SECRET_VALUE'.encode('utf-8'))
print(base64.b64encode(encrypted).decode('utf-8'))
")
    
    # Create or update the secret
    curl -s -X PUT \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "$API_URL/repos/$OWNER/$REPO/actions/secrets/$SECRET_NAME" \
        -d "{\"encrypted_value\":\"$ENCRYPTED_VALUE\",\"key_id\":\"$KEY_ID\"}" > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "✓ Secret $SECRET_NAME set successfully"
    else
        echo "✗ Failed to set secret $SECRET_NAME"
    fi
}

echo "Installing PyNaCl for encryption..."
pip3 install -q PyNaCl

echo ""
echo "Setting up GitHub secrets for $OWNER/$REPO..."
echo ""

# Set each secret
create_secret "PORT" "3456"
create_secret "VITE_PORT" "4567"
create_secret "GITHUB_CLIENT_ID" "Ov23liT5QjgC6iysXd6w"
create_secret "GITHUB_CLIENT_SECRET" "a7d9112a4464dfec0994fd11475458040f242d94"
create_secret "GITHUB_CALLBACK_URL" "http://100.78.142.56:3456/api/auth/github/callback"
create_secret "CLIENT_URL" "http://100.78.142.56:3457"
create_secret "GITHUB_ALLOWED_USERS" "gongiskhan"

echo ""
echo "GitHub secrets setup complete!"
echo "Note: You still need to set GCP_HOST, GCP_USER, and GCP_SSH_KEY manually if not already set."