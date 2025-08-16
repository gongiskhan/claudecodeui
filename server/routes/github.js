import express from 'express';
import { Octokit } from '@octokit/rest';
import { authenticateToken } from '../middleware/auth.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const router = express.Router();
const execAsync = promisify(exec);

// Get user's GitHub repositories
router.get('/repos', authenticateToken, async (req, res) => {
  try {
    if (req.user.auth_provider !== 'github') {
      return res.status(401).json({ error: 'GitHub authentication required' });
    }

    // Get the GitHub access token from the user's session or database
    // For now, we'll need to store it during OAuth callback
    const accessToken = req.user.github_access_token;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub access token not found. Please re-authenticate.' });
    }

    const octokit = new Octokit({
      auth: accessToken
    });

    // Get organization parameter if provided
    const { org } = req.query;
    
    let allRepos = [];
    
    if (org) {
      // Fetch organization repositories using automatic pagination
      console.log(`Fetching all repositories for organization: ${org}`);
      allRepos = await octokit.paginate(octokit.repos.listForOrg, {
        org,
        per_page: 100,
        type: 'all'
      });
    } else {
      // Fetch all user repositories using automatic pagination
      console.log('Fetching all user repositories...');
      
      // First get repos where user is owner
      const ownedRepos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
        per_page: 100,
        type: 'owner',
        sort: 'updated',
        direction: 'desc'
      });
      console.log(`Fetched ${ownedRepos.length} owned repositories`);
      
      // Then get repos from organizations
      const orgRepos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
        per_page: 100,
        type: 'member',
        sort: 'updated',
        direction: 'desc'
      });
      console.log(`Fetched ${orgRepos.length} organization repositories`);
      
      // Combine and deduplicate
      const repoMap = new Map();
      [...ownedRepos, ...orgRepos].forEach(repo => {
        repoMap.set(repo.id, repo);
      });
      
      allRepos = Array.from(repoMap.values());
    }

    console.log(`Fetched ${allRepos.length} repositories`);

    // Format the repository data
    const formattedRepos = allRepos.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      language: repo.language,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url,
        type: repo.owner.type // 'User' or 'Organization'
      }
    }));

    res.json({ repositories: formattedRepos });
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Get user's organizations
router.get('/orgs', authenticateToken, async (req, res) => {
  try {
    if (req.user.auth_provider !== 'github') {
      return res.status(401).json({ error: 'GitHub authentication required' });
    }

    const accessToken = req.user.github_access_token;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'GitHub access token not found. Please re-authenticate.' });
    }

    const octokit = new Octokit({
      auth: accessToken
    });

    // Fetch user's organizations
    const { data: orgs } = await octokit.orgs.listForAuthenticatedUser({
      per_page: 100
    });

    // Format the organization data
    const formattedOrgs = orgs.map(org => ({
      id: org.id,
      login: org.login,
      name: org.name,
      description: org.description,
      avatarUrl: org.avatar_url,
      reposUrl: org.repos_url
    }));

    res.json({ organizations: formattedOrgs });
  } catch (error) {
    console.error('Error fetching GitHub organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Clone a GitHub repository
router.post('/clone', authenticateToken, async (req, res) => {
  try {
    let { repoUrl, targetPath, useSsh } = req.body;

    if (!repoUrl || !targetPath) {
      return res.status(400).json({ error: 'Repository URL and target path are required' });
    }

    // Resolve ~ to home directory
    if (targetPath.startsWith('~/')) {
      targetPath = path.join(os.homedir(), targetPath.slice(2));
    }

    // Ensure the target directory exists
    const parentDir = path.dirname(targetPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Check if target directory already exists
    try {
      await fs.access(targetPath);
      return res.status(400).json({ error: 'Target directory already exists' });
    } catch {
      // Directory doesn't exist, which is what we want
    }

    // Clone the repository
    const cloneUrl = useSsh && req.body.sshUrl ? req.body.sshUrl : repoUrl;
    const command = `git clone "${cloneUrl}" "${targetPath}"`;
    
    console.log(`Cloning repository: ${cloneUrl} to ${targetPath}`);
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });

    // Check if the clone was successful
    try {
      await fs.access(path.join(targetPath, '.git'));
      res.json({ 
        success: true, 
        message: 'Repository cloned successfully',
        path: targetPath,
        output: stdout || stderr
      });
    } catch {
      throw new Error('Repository clone verification failed');
    }
  } catch (error) {
    console.error('Error cloning repository:', error);
    res.status(500).json({ 
      error: 'Failed to clone repository', 
      details: error.message 
    });
  }
});

// Check if a directory path is available for cloning
router.post('/check-path', authenticateToken, async (req, res) => {
  try {
    const { path: checkPath } = req.body;

    if (!checkPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    // Check if the path already exists
    try {
      await fs.access(checkPath);
      res.json({ available: false, exists: true });
    } catch {
      // Path doesn't exist, check if parent directory is writable
      const parentDir = path.dirname(checkPath);
      try {
        await fs.access(parentDir, fs.constants.W_OK);
        res.json({ available: true, exists: false });
      } catch {
        res.json({ available: false, exists: false, error: 'Parent directory is not writable' });
      }
    }
  } catch (error) {
    console.error('Error checking path:', error);
    res.status(500).json({ error: 'Failed to check path availability' });
  }
});

export default router;