#!/bin/bash

# Script to clean up orphaned git worktree registrations

echo "🧹 Cleaning up orphaned git worktree registrations..."

# Check if calenzo project exists
if [ -d "/Users/ggomes/IdeaProjects/calenzo" ]; then
    echo "📁 Found calenzo project, checking worktrees..."
    cd "/Users/ggomes/IdeaProjects/calenzo"
    
    echo "📋 Current worktree list:"
    git worktree list
    
    echo "🧹 Pruning orphaned worktree registrations..."
    git worktree prune -v
    
    echo "📋 After cleanup:"
    git worktree list
else
    echo "❌ Calenzo project not found at /Users/ggomes/IdeaProjects/calenzo"
fi

# Clean up invalid Claude session directories
echo "🧹 Cleaning up invalid Claude session directories..."
CLAUDE_PROJECTS_DIR="/Users/ggomes/.claude/projects"

if [ -d "$CLAUDE_PROJECTS_DIR" ]; then
    echo "📁 Found Claude projects directory"
    
    # Remove directories that start with -Users-ggomes-IdeaProjects-calenzo
    find "$CLAUDE_PROJECTS_DIR" -maxdepth 1 -type d -name "*calenzo*" -exec rm -rf {} \; 2>/dev/null || true
    
    echo "✅ Cleaned up calenzo-related session directories"
else
    echo "❌ Claude projects directory not found"
fi

echo "✅ Cleanup completed!"