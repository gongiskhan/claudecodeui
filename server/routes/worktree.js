import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/**
 * Simple Worktree API Routes
 * 
 * Provides basic REST endpoints for Git worktree operations:
 * - List existing worktrees
 * - Create new worktrees  
 * - Delete worktrees with cleanup
 */

// Helper function to get the main project path
function getMainProjectPath() {
  // Go up from server/routes/ to project root
  return path.resolve(__dirname, '..', '..');
}

// Helper function to get worktrees base path  
function getWorktreesBasePath() {
  const mainProjectPath = getMainProjectPath();
  return path.join(path.dirname(mainProjectPath), 'worktrees');
}

// Helper function to get project name for worktree naming
function getProjectName() {
  const mainProjectPath = getMainProjectPath();
  return path.basename(mainProjectPath);
}

// Helper function to execute git commands
function executeGitCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const process = spawn(cmd, args, { 
      cwd, 
      stdio: ['pipe', 'pipe', 'pipe'] 
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Git command failed: ${stderr}`));
      }
    });
  });
}

// Helper function to delete Claude project sessions
async function deleteClaudeProjectSessions(worktreeName) {
  try {
    // Claude CLI encodes the full worktree path as the project name
    const worktreesBasePath = getWorktreesBasePath();
    const worktreePath = path.join(worktreesBasePath, worktreeName);
    const claudeProjectName = worktreePath.replace(/\//g, '-');
    const claudeProjectPath = path.join(process.env.HOME, '.claude', 'projects', claudeProjectName);
    
    console.log(`🧹 Cleaning up Claude sessions at: ${claudeProjectPath}`);
    
    // Check if Claude project directory exists
    try {
      await fs.access(claudeProjectPath);
      await fs.rm(claudeProjectPath, { recursive: true, force: true });
      console.log(`✅ Successfully deleted Claude project sessions`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`📝 No Claude sessions found to clean up`);
        return true;
      }
      throw error;
    }
  } catch (error) {
    console.error(`❌ Error cleaning up Claude sessions:`, error.message);
    return false;
  }
}

// GET /api/worktree - List all worktrees
router.get('/', async (req, res) => {
  try {
    const worktreesBasePath = getWorktreesBasePath();
    const mainProjectPath = getMainProjectPath();
    const projectName = getProjectName();
    
    console.log(`📋 Listing worktrees for project: ${projectName} from: ${worktreesBasePath}`);
    
    // Check if worktrees directory exists
    let worktrees = [];
    try {
      await fs.access(worktreesBasePath);
      const entries = await fs.readdir(worktreesBasePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith(`${projectName}-`)) {
          const worktreePath = path.join(worktreesBasePath, entry.name);
          
          // Check if it's a valid git worktree
          try {
            await fs.access(path.join(worktreePath, '.git'));
            
            // Get git status
            let status = 'unknown';
            let branch = 'unknown';
            try {
              const branchOutput = await executeGitCommand('git branch --show-current', worktreePath);
              branch = branchOutput || 'detached';
              
              const statusOutput = await executeGitCommand('git status --porcelain', worktreePath);
              status = statusOutput.trim() === '' ? 'clean' : 'modified';
            } catch (error) {
              console.warn(`Could not get git status for ${entry.name}:`, error.message);
            }
            
            worktrees.push({
              version: entry.name,
              path: worktreePath,
              status,
              branch,
              exists: true
            });
          } catch (error) {
            // Directory exists but is not a git worktree
            console.warn(`Directory ${entry.name} is not a valid git worktree`);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // Worktrees directory doesn't exist yet - that's fine
      console.log(`📁 Worktrees directory doesn't exist yet: ${worktreesBasePath}`);
    }
    
    // Check which versions are available to create (V2-V11)
    const availableVersions = ['V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11'];
    const existingVersions = new Set(worktrees.map(w => w.version));
    
    const availableToCreate = availableVersions.filter(v => !existingVersions.has(v));
    
    res.json({
      worktrees,
      availableToCreate,
      basePath: worktreesBasePath,
      mainProjectPath
    });
  } catch (error) {
    console.error('List worktrees error:', error);
    res.status(500).json({ 
      error: 'Failed to list worktrees',
      details: error.message 
    });
  }
});

// POST /api/worktree/create/:version - Create a new worktree
router.post('/create/:version', async (req, res) => {
  try {
    const { version } = req.params;
    const { branch, projectPath, projectName } = req.body;
    
    // Validate version
    if (!['V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11'].includes(version)) {
      return res.status(400).json({ error: 'Version must be V2-V11' });
    }
    
    // Validate required project information
    if (!projectPath || !projectName) {
      return res.status(400).json({ error: 'Project path and name are required' });
    }
    
    const mainProjectPath = projectPath;
    const worktreesBasePath = getWorktreesBasePath();
    const worktreeName = `${projectName}-${version.toLowerCase()}`;
    const worktreePath = path.join(worktreesBasePath, worktreeName);
    
    console.log(`🌳 Creating worktree ${worktreeName} at: ${worktreePath}`);
    
    // Check if worktree already exists
    try {
      await fs.access(worktreePath);
      return res.status(409).json({ error: `Worktree ${version} already exists` });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    // Create worktrees directory if it doesn't exist
    await fs.mkdir(worktreesBasePath, { recursive: true });
    
    // First, prune any orphaned worktree registrations to prevent conflicts
    try {
      await executeGitCommand('git worktree prune', mainProjectPath);
      console.log(`🧹 Git worktree prune completed before creation`);
    } catch (pruneError) {
      console.warn(`⚠️ Git worktree prune failed:`, pruneError.message);
    }
    
    // Create the git worktree
    const branchName = branch || `feature/${version.toLowerCase()}`;
    
    // Check if branch already exists
    let gitCommand;
    try {
      await executeGitCommand(`git show-ref --verify refs/heads/${branchName}`, mainProjectPath);
      // Branch exists, use it without creating new one
      gitCommand = `git worktree add ${worktreePath} ${branchName}`;
      console.log(`🔄 Using existing branch: ${branchName}`);
    } catch (error) {
      // Branch doesn't exist, create new one
      gitCommand = `git worktree add -b ${branchName} ${worktreePath}`;
      console.log(`🆕 Creating new branch: ${branchName}`);
    }
    
    console.log(`🔧 Executing: ${gitCommand}`);
    console.log(`📁 From directory: ${mainProjectPath}`);
    
    try {
      const output = await executeGitCommand(gitCommand, mainProjectPath);
      console.log(`✅ Git worktree created successfully:`, output);
      
      // Get the actual branch name and status
      const actualBranch = await executeGitCommand('git branch --show-current', worktreePath);
      const status = await executeGitCommand('git status --porcelain', worktreePath);
      
      res.json({
        success: true,
        version,
        path: worktreePath,
        branch: actualBranch,
        status: status.trim() === '' ? 'clean' : 'modified',
        message: `Worktree ${version} created successfully`
      });
    } catch (error) {
      console.error(`❌ Failed to create git worktree:`, error.message);
      
      // Handle specific case of missing but registered worktree
      if (error.message.includes('missing but already registered')) {
        console.log(`🔧 Attempting to clean up orphaned worktree registration`);
        
        try {
          // Force remove the registration and try again
          await executeGitCommand('git worktree prune', mainProjectPath);
          console.log(`🧹 Pruned orphaned registrations, retrying creation`);
          
          // Retry the creation
          const retryOutput = await executeGitCommand(gitCommand, mainProjectPath);
          console.log(`✅ Git worktree created successfully on retry:`, retryOutput);
          
          // Get the actual branch name and status
          const actualBranch = await executeGitCommand('git branch --show-current', worktreePath);
          const status = await executeGitCommand('git status --porcelain', worktreePath);
          
          return res.json({
            success: true,
            version,
            path: worktreePath,
            branch: actualBranch,
            status: status.trim() === '' ? 'clean' : 'modified',
            message: `Worktree ${version} created successfully after cleanup`
          });
        } catch (retryError) {
          console.error(`❌ Retry also failed:`, retryError.message);
        }
      }
      
      // Clean up any partially created directory
      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up directory ${worktreePath}:`, cleanupError.message);
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Create worktree error:', error);
    res.status(500).json({ 
      error: 'Failed to create worktree',
      details: error.message 
    });
  }
});

// DELETE /api/worktree/:version - Delete a worktree and its Claude sessions
router.delete('/:version', async (req, res) => {
  try {
    const { version } = req.params;
    
    // Validate version
    if (!['V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11'].includes(version)) {
      return res.status(400).json({ error: 'Version must be V2-V11' });
    }
    
    const worktreesBasePath = getWorktreesBasePath();
    
    // Scan worktrees directory to find which project this version belongs to
    let worktreeName = null;
    let worktreePath = null;
    let mainProjectPath = null;
    
    try {
      const entries = await fs.readdir(worktreesBasePath, { withFileTypes: true });
      const versionLower = version.toLowerCase();
      
      // Look for worktree that ends with the version (e.g., "calenzo-v2")
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.endsWith(`-${versionLower}`)) {
          worktreeName = entry.name;
          worktreePath = path.join(worktreesBasePath, worktreeName);
          
          // Extract project name (everything before the last dash and version)
          const lastDashIndex = entry.name.lastIndexOf('-');
          const projectName = entry.name.substring(0, lastDashIndex);
          
          // Try to find the main project path by looking in common locations
          const possiblePaths = [
            path.join(path.dirname(worktreesBasePath), projectName),
            path.join(process.env.HOME, 'IdeaProjects', projectName),
            path.join(process.env.HOME, 'dev', projectName),
            path.join(process.env.HOME, 'projects', projectName)
          ];
          
          for (const possiblePath of possiblePaths) {
            try {
              await fs.access(possiblePath);
              mainProjectPath = possiblePath;
              break;
            } catch (e) {
              // Continue searching
            }
          }
          
          break;
        }
      }
      
      if (!worktreeName) {
        return res.status(404).json({ error: `Worktree ${version} does not exist` });
      }
      
      if (!mainProjectPath) {
        console.warn(`⚠️ Could not find main project path for ${worktreeName}, using worktree directory for git operations`);
        mainProjectPath = worktreePath;
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: `Worktrees directory does not exist` });
      }
      throw error;
    }
    
    console.log(`🗑️ Deleting worktree ${worktreeName} at: ${worktreePath}`);
    console.log(`📁 Using main project path: ${mainProjectPath}`);
    
    // Check if worktree exists
    try {
      await fs.access(worktreePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: `Worktree ${version} does not exist` });
      }
      throw error;
    }
    
    // First, prune any orphaned worktree registrations
    try {
      await executeGitCommand('git worktree prune', mainProjectPath);
      console.log(`🧹 Git worktree prune completed`);
    } catch (pruneError) {
      console.warn(`⚠️ Git worktree prune failed:`, pruneError.message);
    }
    
    // Remove the git worktree
    try {
      const gitCommand = `git worktree remove ${worktreePath}`;
      console.log(`🔧 Executing: ${gitCommand}`);
      
      await executeGitCommand(gitCommand, mainProjectPath);
      console.log(`✅ Git worktree removed successfully`);
    } catch (error) {
      console.warn(`⚠️ Git worktree remove failed, trying force removal:`, error.message);
      
      // Try with force flag
      try {
        const forceCommand = `git worktree remove --force ${worktreePath}`;
        await executeGitCommand(forceCommand, mainProjectPath);
        console.log(`✅ Git worktree force removed successfully`);
      } catch (forceError) {
        console.error(`❌ Force removal also failed, trying manual cleanup:`, forceError.message);
        
        // If git commands fail, try manual cleanup
        try {
          // Delete the directory first
          await fs.rm(worktreePath, { recursive: true, force: true });
          console.log(`✅ Worktree directory manually deleted`);
          
          // Then prune again to clean up git registry
          await executeGitCommand('git worktree prune', mainProjectPath);
          console.log(`🧹 Git registry cleaned up after manual deletion`);
        } catch (manualError) {
          console.error(`❌ Manual cleanup also failed:`, manualError.message);
        }
      }
    }
    
    // Delete the directory
    try {
      await fs.rm(worktreePath, { recursive: true, force: true });
      console.log(`✅ Worktree directory deleted successfully`);
    } catch (error) {
      console.error(`❌ Failed to delete worktree directory:`, error.message);
    }
    
    // Clean up Claude project sessions
    const claudeCleanupSuccess = await deleteClaudeProjectSessions(worktreeName);
    
    res.json({
      success: true,
      version,
      path: worktreePath,
      claudeCleanupSuccess,
      message: `Worktree ${version} deleted successfully`
    });
  } catch (error) {
    console.error('Delete worktree error:', error);
    res.status(500).json({ 
      error: 'Failed to delete worktree',
      details: error.message 
    });
  }
});

// GET /api/worktree/cleanup - Clean up orphaned Claude session directories
router.get('/cleanup', async (req, res) => {
  try {
    const claudeProjectsDir = path.join(process.env.HOME, '.claude', 'projects');
    const worktreesBasePath = getWorktreesBasePath();
    
    console.log(`🧹 Cleaning up orphaned worktree sessions...`);
    
    let cleanedCount = 0;
    
    try {
      const claudeEntries = await fs.readdir(claudeProjectsDir, { withFileTypes: true });
      
      for (const entry of claudeEntries) {
        // Look for old-style worktree session directories (contain full paths)
        // OR invalid encoded project names that start with dashes
        const isOldWorktreeDir = entry.isDirectory() && entry.name.includes('-Users-') && entry.name.includes('-worktrees-');
        const isInvalidEncodedName = entry.isDirectory() && entry.name.startsWith('-Users-') && !entry.name.includes('-worktrees-');
        
        if (isOldWorktreeDir || isInvalidEncodedName) {
          const claudeProjectPath = path.join(claudeProjectsDir, entry.name);
          
          console.log(`🗑️ Removing orphaned/invalid session directory: ${entry.name}`);
          
          try {
            await fs.rm(claudeProjectPath, { recursive: true, force: true });
            cleanedCount++;
          } catch (error) {
            console.warn(`Warning: Could not remove ${entry.name}:`, error.message);
          }
        }
      }
      
      res.json({
        success: true,
        cleanedCount,
        message: `Cleaned up ${cleanedCount} orphaned worktree session directories`
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({ success: true, cleanedCount: 0, message: 'No Claude projects directory found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ 
      error: 'Failed to clean up orphaned sessions',
      details: error.message 
    });
  }
});

export default router;