#!/bin/bash

# Script to create .env file on the GCP server
# Run this locally to set up the environment on the remote server

echo "This script will create the .env file on your GCP server."
echo "Please enter your GCP server details:"
echo -n "GCP Host/IP: "
read GCP_HOST
echo -n "GCP Username: "
read GCP_USER

# Create the .env content
ENV_CONTENT='PORT=3456
VITE_PORT=4567
GITHUB_CLIENT_ID=Ov23liT5QjgC6iysXd6w
GITHUB_CLIENT_SECRET=a7d9112a4464dfec0994fd11475458040f242d94
GITHUB_CALLBACK_URL=http://100.78.142.56:3456/api/auth/github/callback
CLIENT_URL=http://100.78.142.56:3457
GITHUB_ALLOWED_USERS=gongiskhan'

# SSH to the server and create the .env file
ssh $GCP_USER@$GCP_HOST "cd ~/claudecodeui && cat > .env << 'EOF'
$ENV_CONTENT
EOF"

if [ $? -eq 0 ]; then
    echo "✓ .env file created successfully on the server!"
    echo ""
    echo "You can now deploy using GitHub Actions, or manually restart the app with:"
    echo "ssh $GCP_USER@$GCP_HOST 'cd ~/claudecodeui && pm2 restart claudecodeui'"
else
    echo "✗ Failed to create .env file on the server"
fi