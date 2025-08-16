#!/bin/bash

# Setup GitHub secrets for deployment
# This script uses the GitHub CLI (gh) to create repository secrets

REPO="gongiskhan/claudecodeui"

echo "Setting up GitHub secrets for $REPO..."

# Server configuration
gh secret set PORT --repo "$REPO" --body "3456"
gh secret set VITE_PORT --repo "$REPO" --body "4567"

# GitHub OAuth configuration
gh secret set GITHUB_CLIENT_ID --repo "$REPO" --body "Ov23liT5QjgC6iysXd6w"
gh secret set GITHUB_CLIENT_SECRET --repo "$REPO" --body "a7d9112a4464dfec0994fd11475458040f242d94"
gh secret set GITHUB_CALLBACK_URL --repo "$REPO" --body "http://100.78.142.56:3456/api/auth/github/callback"
gh secret set CLIENT_URL --repo "$REPO" --body "http://100.78.142.56:3457"
gh secret set GITHUB_ALLOWED_USERS --repo "$REPO" --body "gongiskhan"

echo "GitHub secrets have been configured successfully!"
echo "Note: You still need to set GCP_HOST, GCP_USER, and GCP_SSH_KEY manually if not already set."