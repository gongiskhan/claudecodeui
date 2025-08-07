#!/bin/bash

# Simple update script - just syncs files without restarting
# Configuration
GCP_HOST="100.78.142.56"  # GCP machine IP
GCP_USER="developer"  # GCP username
REMOTE_DIR="~/claudecodeui"  # Remote directory on GCP machine
LOCAL_DIR="."  # Local project directory

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Syncing files to GCP machine...${NC}"

# Check if rsync is available
if ! command -v rsync &> /dev/null; then
    echo -e "${RED}rsync is not installed. Please install it first.${NC}"
    exit 1
fi

# Files and directories to exclude from sync
EXCLUDE_PATTERNS=(
    "node_modules/"
    ".git/"
    ".env"
    "*.log"
    "dist/"
    "build/"
    ".DS_Store"
    "*.swp"
    "*.swo"
    "server/database/*.db"
    "server/database/*.db-journal"
    ".claude/"
    "*.tmp"
    "coverage/"
    ".nyc_output/"
)

# Build exclude arguments for rsync
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude='$pattern'"
done

# Sync files to GCP machine
echo -e "${GREEN}Syncing to $GCP_USER@$GCP_HOST:$REMOTE_DIR${NC}"

# Use rsync to transfer files with sshpass for authentication
SSHPASS='m' sshpass -e rsync -avz --progress --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    $EXCLUDE_ARGS \
    "$LOCAL_DIR/" \
    "$GCP_USER@$GCP_HOST:$REMOTE_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Files synced successfully!${NC}"
    echo -e "${YELLOW}Note: The app should automatically reload with the new changes.${NC}"
    echo -e "${YELLOW}If not, you may need to restart it manually on the GCP machine.${NC}"
else
    echo -e "${RED}✗ Failed to sync files to GCP machine${NC}"
    exit 1
fi