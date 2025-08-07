#!/bin/bash

# Configuration
GCP_HOST="gcp"  # Update this with your GCP machine hostname or IP
GCP_USER="ggomes"  # Update this with your GCP username
REMOTE_DIR="~/claudecodeui"  # Remote directory on GCP machine
LOCAL_DIR="."  # Local project directory

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Updating Claude Code UI on GCP machine...${NC}"

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
echo -e "${GREEN}Syncing files to $GCP_USER@$GCP_HOST:$REMOTE_DIR${NC}"

# Use rsync to transfer files
eval rsync -avz --progress --delete \
    $EXCLUDE_ARGS \
    "$LOCAL_DIR/" \
    "$GCP_USER@$GCP_HOST:$REMOTE_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Files synced successfully!${NC}"
    
    # Optional: Restart the app on the remote machine
    echo -e "${YELLOW}Restarting the app on GCP...${NC}"
    
    # Kill existing npm process and restart
    ssh "$GCP_USER@$GCP_HOST" << 'EOF'
        cd ~/claudecodeui
        
        # Find and kill existing npm dev process
        PID=$(pgrep -f "npm run dev" | head -1)
        if [ ! -z "$PID" ]; then
            echo "Stopping existing process (PID: $PID)..."
            kill $PID
            sleep 2
        fi
        
        # Check if package.json has changed and run npm install if needed
        if [ -f .update-marker ]; then
            LAST_PACKAGE_HASH=$(cat .update-marker 2>/dev/null)
        fi
        CURRENT_PACKAGE_HASH=$(md5sum package.json | cut -d' ' -f1)
        
        if [ "$LAST_PACKAGE_HASH" != "$CURRENT_PACKAGE_HASH" ]; then
            echo "package.json has changed, running npm install..."
            npm install
            echo "$CURRENT_PACKAGE_HASH" > .update-marker
        fi
        
        # Start the app in background
        echo "Starting the app..."
        nohup npm run dev > app.log 2>&1 &
        
        # Wait a moment and check if it started
        sleep 3
        if pgrep -f "npm run dev" > /dev/null; then
            echo "✓ App restarted successfully!"
            echo "You can check logs with: tail -f ~/claudecodeui/app.log"
        else
            echo "⚠ Failed to start the app. Check app.log for details."
        fi
EOF
    
    echo -e "${GREEN}✓ Update complete!${NC}"
else
    echo -e "${RED}✗ Failed to sync files to GCP machine${NC}"
    exit 1
fi