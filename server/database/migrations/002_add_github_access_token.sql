-- Migration: Add GitHub access token column for storing OAuth tokens
-- This is required for GitHub API operations like fetching repos and cloning

-- Add github_access_token column to users table
ALTER TABLE users ADD COLUMN github_access_token TEXT;

-- Index for faster lookups when checking GitHub authentication
CREATE INDEX IF NOT EXISTS idx_users_github_access_token ON users(github_access_token);