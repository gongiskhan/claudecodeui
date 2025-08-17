import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import readline from 'readline';
import { getSession, getSessionsForProject, invalidateCacheForProject } from './sessions.js';

// Cache for extracted project directories
const projectDirectoryCache = new Map();
let cacheTimestamp = Date.now();

// Clear cache when needed (called when project files change)
function clearProjectDirectoryCache() {
  projectDirectoryCache.clear();
  cacheTimestamp = Date.now();
}

// Helper function to decode project names that are encoded paths
function decodeProjectPath(projectName) {
  // If it starts with a dash, it's an encoded path
  if (projectName.startsWith('-')) {
    // Remove leading dash and replace remaining dashes with slashes
    return '/' + projectName.substring(1).replace(/-/g, '/');
  }
  // Otherwise, return as-is (it's a regular project name)
  return projectName;
}

// Load project configuration file
async function loadProjectConfig() {
  const configPath = path.join(process.env.HOME, '.claude', 'project-config.json');
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // Return empty config if file doesn't exist
    return {};
  }
}

// Save project configuration file
async function saveProjectConfig(config) {
  const configPath = path.join(process.env.HOME, '.claude', 'project-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// Generate better display name from path
async function generateDisplayName(projectName, actualProjectDir = null) {
  // Use actual project directory if provided, otherwise decode from project name
  let projectPath = actualProjectDir || decodeProjectPath(projectName);
  
  // SPECIAL HANDLING FOR WORKTREES - NEVER use package.json for worktree display names
  // Check if this is a worktree path (contains '/worktrees/' and ends with version)
  if (projectPath.includes('/worktrees/') && projectPath.match(/-v\d+$/)) {
    const parts = projectPath.split('/');
    const worktreeName = parts[parts.length - 1]; // e.g., "agendamente-v2"
    
    const lastDashIndex = worktreeName.lastIndexOf('-v');
    if (lastDashIndex !== -1) {
      const projectName = worktreeName.substring(0, lastDashIndex);
      const version = worktreeName.substring(lastDashIndex + 1).toUpperCase();
      return `${projectName} - ${version}`;
    }
  }
  
  // For non-worktree projects, try to read package.json
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageData = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageData);
    
    // Return the name from package.json if it exists (but not for worktrees)
    if (packageJson.name && !projectPath.includes('/worktrees/')) {
      return packageJson.name;
    }
  } catch (error) {
    // Fall back to path-based naming if package.json doesn't exist or can't be read
  }
  
  // If it starts with /, it's an absolute path
  if (projectPath.startsWith('/')) {
    const parts = projectPath.split('/').filter(Boolean);
    // Return only the last folder name
    return parts[parts.length - 1] || projectPath;
  }
  
  return projectPath;
}

// Extract the actual project directory from JSONL sessions (with caching)
async function extractProjectDirectory(projectName) {
  // Check cache first
  if (projectDirectoryCache.has(projectName)) {
    return projectDirectoryCache.get(projectName);
  }
  
  // Special handling for worktree projects
  // Check if this project name corresponds to a worktree directory
  const worktreesBasePath = path.join(process.env.HOME, 'IdeaProjects', 'worktrees');
  try {
    await fs.access(worktreesBasePath);
    const worktreeEntries = await fs.readdir(worktreesBasePath, { withFileTypes: true });
    
    for (const entry of worktreeEntries) {
      if (entry.isDirectory() && entry.name.includes('-v')) {
        // Check if the encoded project name matches this worktree directory
        const worktreePath = path.join(worktreesBasePath, entry.name);
        const encodedWorktreePath = worktreePath.replace(/\//g, '-');
        if (encodedWorktreePath === projectName) {
          // Verify it's a valid git worktree
          try {
            await fs.access(path.join(worktreePath, '.git'));
            // Cache and return the worktree path
            projectDirectoryCache.set(projectName, worktreePath);
            return worktreePath;
          } catch (error) {
            // Not a valid worktree, continue checking
          }
        }
      }
    }
  } catch (error) {
    // Worktrees folder doesn't exist, continue with normal logic
  }
  
  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  const cwdCounts = new Map();
  let latestTimestamp = 0;
  let latestCwd = null;
  let extractedPath;
  
  try {
    // Check if the project directory exists first
    try {
      await fs.access(projectDir);
    } catch (accessError) {
      if (accessError.code === 'ENOENT') {
        // Project directory doesn't exist, check config for originalPath
        console.warn(`Project directory not found for ${projectName}, checking config`);
        const config = await loadProjectConfig();
        if (config[projectName] && config[projectName].originalPath) {
          extractedPath = config[projectName].originalPath;
          console.log(`Using originalPath from config: ${extractedPath}`);
        } else {
          // Fall back to decoded project name
          extractedPath = decodeProjectPath(projectName);
          console.log(`Using decoded path: ${extractedPath}`);
        }
        projectDirectoryCache.set(projectName, extractedPath);
        return extractedPath;
      }
      throw accessError;
    }
    
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      // No sessions, check config first
      const config = await loadProjectConfig();
      if (config[projectName] && config[projectName].originalPath) {
        extractedPath = config[projectName].originalPath;
      } else {
        // Fall back to decoded project name if no config
        extractedPath = decodeProjectPath(projectName);
      }
    } else {
      // Process all JSONL files to collect cwd values
      for (const file of jsonlFiles) {
        const jsonlFile = path.join(projectDir, file);
        const fileStream = fsSync.createReadStream(jsonlFile);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });
        
        for await (const line of rl) {
          if (line.trim()) {
            try {
              const entry = JSON.parse(line);
              
              if (entry.cwd) {
                // Count occurrences of each cwd
                cwdCounts.set(entry.cwd, (cwdCounts.get(entry.cwd) || 0) + 1);
                
                // Track the most recent cwd
                const timestamp = new Date(entry.timestamp || 0).getTime();
                if (timestamp > latestTimestamp) {
                  latestTimestamp = timestamp;
                  latestCwd = entry.cwd;
                }
              }
            } catch (parseError) {
              // Skip malformed lines
            }
          }
        }
      }
      
      // Determine the best cwd to use
      if (cwdCounts.size === 0) {
        // No cwd found, fall back to decoded project name
        extractedPath = decodeProjectPath(projectName);
      } else if (cwdCounts.size === 1) {
        // Only one cwd, use it
        extractedPath = Array.from(cwdCounts.keys())[0];
      } else {
        // Multiple cwd values - prefer the most recent one if it has reasonable usage
        const mostRecentCount = cwdCounts.get(latestCwd) || 0;
        const maxCount = Math.max(...cwdCounts.values());
        
        // Use most recent if it has at least 25% of the max count
        if (mostRecentCount >= maxCount * 0.25) {
          extractedPath = latestCwd;
        } else {
          // Otherwise use the most frequently used cwd
          for (const [cwd, count] of cwdCounts.entries()) {
            if (count === maxCount) {
              extractedPath = cwd;
              break;
            }
          }
        }
        
        // Fallback (shouldn't reach here)
        if (!extractedPath) {
          extractedPath = latestCwd || decodeProjectPath(projectName);
        }
      }
    }
    
    // Cache the result
    projectDirectoryCache.set(projectName, extractedPath);
    
    return extractedPath;
    
  } catch (error) {
    console.error(`Error extracting project directory for ${projectName}:`, error);
    // Fall back to decoded project name
    extractedPath = decodeProjectPath(projectName);
    
    // Cache the fallback result too
    projectDirectoryCache.set(projectName, extractedPath);
    
    return extractedPath;
  }
}

async function getProjects() {
  const claudeDir = path.join(process.env.HOME, '.claude', 'projects');
  const config = await loadProjectConfig();
  const projects = [];
  const existingProjects = new Set();
  
  // Add worktree projects as regular projects with version prefixes
  const worktreesBasePath = path.join(process.env.HOME, 'IdeaProjects', 'worktrees');
  try {
    await fs.access(worktreesBasePath);
    const worktreeEntries = await fs.readdir(worktreesBasePath, { withFileTypes: true });
    
    for (const entry of worktreeEntries) {
      if (entry.isDirectory() && entry.name.includes('-v')) {
        const worktreePath = path.join(worktreesBasePath, entry.name);
        
        // Verify this is actually a valid git worktree
        try {
          await fs.access(path.join(worktreePath, '.git'));
        } catch (error) {
          console.warn(`Skipping invalid worktree directory: ${entry.name}`);
          continue;
        }
        
        // Extract project name and version from worktree name (e.g., "calenzo-v2" -> "calenzo", "V2")
        const lastDashIndex = entry.name.lastIndexOf('-v');
        if (lastDashIndex === -1) continue;
        
        const projectName = entry.name.substring(0, lastDashIndex);
        const versionPart = entry.name.substring(lastDashIndex + 1);
        const version = versionPart.toUpperCase();
        
        // Create project entry for worktree
        // Claude CLI encodes the full path, so we need to match that encoding
        const claudeProjectName = worktreePath.replace(/\//g, '-');
        const worktreeProject = {
          name: claudeProjectName, // Use full path encoding to match Claude CLI behavior
          path: worktreePath,
          displayName: `${projectName} - ${version}`,
          fullPath: worktreePath,
          isCustomName: false,
          isWorktree: true,
          worktreeVersion: version,
          baseProjectName: projectName,
          sessions: []
        };
        
        // Try to get sessions for this worktree project
        try {
          const sessionResult = await getSessions(worktreeProject.name, 5, 0);
          worktreeProject.sessions = sessionResult.sessions || [];
          worktreeProject.sessionMeta = {
            hasMore: sessionResult.hasMore,
            total: sessionResult.total
          };
        } catch (e) {
          console.warn(`Could not load sessions for worktree project ${worktreeProject.name}:`, e.message);
        }
        
        projects.push(worktreeProject);
      }
    }
  } catch (error) {
    // Worktrees folder doesn't exist, skip
  }
  
  try {
    // Only get projects that have been manually added via config
    const entries = await fs.readdir(claudeDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        existingProjects.add(entry.name);
        
        // Only include if manually added in config 
        // (EXCLUDE worktree-related projects as they're already added above)
        if (config[entry.name]?.manuallyAdded && !entry.name.includes('worktrees')) {
          const projectPath = path.join(claudeDir, entry.name);
          
          // Extract actual project directory from JSONL sessions
          const actualProjectDir = await extractProjectDirectory(entry.name);
          
          // Get display name from config or generate one
          const customName = config[entry.name]?.displayName;
          const autoDisplayName = await generateDisplayName(entry.name, actualProjectDir);
          const fullPath = actualProjectDir;
          
          const project = {
            name: entry.name,
            path: actualProjectDir,
            displayName: customName || autoDisplayName,
            fullPath: fullPath,
            isCustomName: !!customName,
            sessions: []
          };
          
          // Try to get sessions for this project (just first 5 for performance)
          try {
            const sessionResult = await getSessions(entry.name, 5, 0);
            project.sessions = sessionResult.sessions || [];
            project.sessionMeta = {
              hasMore: sessionResult.hasMore,
              total: sessionResult.total
            };
          } catch (e) {
            console.warn(`Could not load sessions for project ${entry.name}:`, e.message);
          }
          
          projects.push(project);
        }
      }
    }
  } catch (error) {
    console.error('Error reading projects directory:', error);
  }
  
  // Add manually configured projects that don't exist as folders yet
  for (const [projectName, projectConfig] of Object.entries(config)) {
    if (!existingProjects.has(projectName) && projectConfig.manuallyAdded) {
      // Use the original path if available, otherwise extract from potential sessions
      let actualProjectDir = projectConfig.originalPath;
      
      if (!actualProjectDir) {
        try {
          actualProjectDir = await extractProjectDirectory(projectName);
        } catch (error) {
          // Fall back to decoded project name
          actualProjectDir = decodeProjectPath(projectName);
        }
      }
      
      const project = {
        name: projectName,
        path: actualProjectDir,
        displayName: projectConfig.displayName || await generateDisplayName(projectName, actualProjectDir),
        fullPath: actualProjectDir,
        isCustomName: !!projectConfig.displayName,
        isManuallyAdded: true,
        sessions: []
      };
      
      // Try to fetch Cursor sessions for manual projects too
      try {
        project.cursorSessions = await getCursorSessions(actualProjectDir);
      } catch (e) {
        console.warn(`Could not load Cursor sessions for manual project ${projectName}:`, e.message);
      }
      
      projects.push(project);
    }
  }
  
  return projects;
}

async function getSessions(projectName, limit = 5, offset = 0) {
  try {
    const allSessions = await getSessionsForProject(projectName);
    const total = allSessions.length;
    const paginatedSessions = allSessions.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      sessions: paginatedSessions,
      hasMore,
      total,
      offset,
      limit,
    };
  } catch (error) {
    console.error(`Error reading sessions for project ${projectName}:`, error);
    return { sessions: [], hasMore: false, total: 0 };
  }
}

// Get messages for a specific session
async function getSessionMessages(projectName, sessionId) {
  try {
    return await getSession(projectName, sessionId);
  } catch (error) {
    console.error(`Error reading messages for session ${sessionId}:`, error);
    return limit === null ? [] : { messages: [], total: 0, hasMore: false };
  }
}

// Rename a project's display name
async function renameProject(projectName, newDisplayName) {
  const config = await loadProjectConfig();
  
  if (!newDisplayName || newDisplayName.trim() === '') {
    // Remove custom name if empty, will fall back to auto-generated
    delete config[projectName];
  } else {
    // Set custom display name
    config[projectName] = {
      displayName: newDisplayName.trim()
    };
  }
  
  await saveProjectConfig(config);
  return true;
}

// Delete a session from a project
async function deleteSession(projectName, sessionId) {
  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      throw new Error('No session files found for this project');
    }
    
    // Check all JSONL files to find which one contains the session
    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file);
      const content = await fs.readFile(jsonlFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Check if this file contains the session
      const hasSession = lines.some(line => {
        try {
          const data = JSON.parse(line);
          return data.sessionId === sessionId;
        } catch {
          return false;
        }
      });
      
      if (hasSession) {
        // Filter out all entries for this session
        const filteredLines = lines.filter(line => {
          try {
            const data = JSON.parse(line);
            return data.sessionId !== sessionId;
          } catch {
            return true; // Keep malformed lines
          }
        });
        
        // Write back the filtered content
        await fs.writeFile(jsonlFile, filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : ''));

        // Invalidate the cache for this project
        invalidateCacheForProject(projectName);

        return true;
      }
    }
    
    throw new Error(`Session ${sessionId} not found in any files`);
  } catch (error) {
    console.error(`Error deleting session ${sessionId} from project ${projectName}:`, error);
    throw error;
  }
}

// Check if a project is empty (has no sessions)
async function isProjectEmpty(projectName) {
  try {
    const sessionsResult = await getSessions(projectName, 1, 0);
    return sessionsResult.total === 0;
  } catch (error) {
    console.error(`Error checking if project ${projectName} is empty:`, error);
    return false;
  }
}

// Delete an empty project
async function deleteProject(projectName) {
  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  
  try {
    // First check if the project is empty
    const isEmpty = await isProjectEmpty(projectName);
    if (!isEmpty) {
      throw new Error('Cannot delete project with existing sessions');
    }
    
    // Remove the project directory
    await fs.rm(projectDir, { recursive: true, force: true });
    
    // Remove from project config
    const config = await loadProjectConfig();
    delete config[projectName];
    await saveProjectConfig(config);
    
    return true;
  } catch (error) {
    console.error(`Error deleting project ${projectName}:`, error);
    throw error;
  }
}

// Remove a project from the browser only (don't delete physical folder)
async function removeProjectFromBrowser(projectName) {
  try {
    // Remove from project config
    const config = await loadProjectConfig();
    if (!config[projectName]) {
      throw new Error(`Project ${projectName} not found in config`);
    }
    
    delete config[projectName];
    await saveProjectConfig(config);
    
    return true;
  } catch (error) {
    console.error(`Error removing project ${projectName} from browser:`, error);
    throw error;
  }
}

// Add a project manually to the config (without creating folders)
async function addProjectManually(projectPath, displayName = null) {
  console.log('📂 addProjectManually called with:', projectPath);
  const absolutePath = path.resolve(projectPath);
  console.log('📂 Resolved to absolute path:', absolutePath);
  
  try {
    // Check if the path exists
    await fs.access(absolutePath);
  } catch (error) {
    console.error('📂 Path check failed for:', absolutePath);
    throw new Error(`Path does not exist: ${absolutePath}`);
  }
  
  // Generate project name (encode path for use as directory name)
  const projectName = absolutePath.replace(/\//g, '-');
  console.log('📂 Generated project name:', projectName);
  
  // Check if project already exists in config
  const config = await loadProjectConfig();
  
  if (config[projectName] && config[projectName].manuallyAdded) {
    throw new Error(`Project already added to browser for path: ${absolutePath}`);
  }
  
  // Add to config as manually added project (or update existing)
  if (!config[projectName]) {
    config[projectName] = {};
  }
  
  config[projectName] = {
    ...config[projectName],
    manuallyAdded: true,
    originalPath: absolutePath
  };
  
  if (displayName) {
    config[projectName].displayName = displayName;
  }
  
  await saveProjectConfig(config);
  
  
  return {
    name: projectName,
    path: absolutePath,
    fullPath: absolutePath,
    displayName: displayName || await generateDisplayName(projectName, absolutePath),
    isManuallyAdded: true,
    sessions: []
  };
}

// Fetch Cursor sessions for a given project path
async function getCursorSessions(projectPath) {
  try {
    // Calculate cwdID hash for the project path (Cursor uses MD5 hash)
    const cwdId = crypto.createHash('md5').update(projectPath).digest('hex');
    const cursorChatsPath = path.join(os.homedir(), '.cursor', 'chats', cwdId);
    
    // Check if the directory exists
    try {
      await fs.access(cursorChatsPath);
    } catch (error) {
      // No sessions for this project
      return [];
    }
    
    // List all session directories
    const sessionDirs = await fs.readdir(cursorChatsPath);
    const sessions = [];
    
    for (const sessionId of sessionDirs) {
      const sessionPath = path.join(cursorChatsPath, sessionId);
      const storeDbPath = path.join(sessionPath, 'store.db');
      
      try {
        // Check if store.db exists
        await fs.access(storeDbPath);
        
        // Capture store.db mtime as a reliable fallback timestamp
        let dbStatMtimeMs = null;
        try {
          const stat = await fs.stat(storeDbPath);
          dbStatMtimeMs = stat.mtimeMs;
        } catch (_) {}

        // Open SQLite database
        const db = await open({
          filename: storeDbPath,
          driver: sqlite3.Database,
          mode: sqlite3.OPEN_READONLY
        });
        
        // Get metadata from meta table
        const metaRows = await db.all(`
          SELECT key, value FROM meta
        `);
        
        // Parse metadata
        let metadata = {};
        for (const row of metaRows) {
          if (row.value) {
            try {
              // Try to decode as hex-encoded JSON
              const hexMatch = row.value.toString().match(/^[0-9a-fA-F]+$/);
              if (hexMatch) {
                const jsonStr = Buffer.from(row.value, 'hex').toString('utf8');
                metadata[row.key] = JSON.parse(jsonStr);
              } else {
                metadata[row.key] = row.value.toString();
              }
            } catch (e) {
              metadata[row.key] = row.value.toString();
            }
          }
        }
        
        // Get message count
        const messageCountResult = await db.get(`
          SELECT COUNT(*) as count FROM blobs
        `);
        
        await db.close();
        
        // Extract session info
        const sessionName = metadata.title || metadata.sessionTitle || 'Untitled Session';
        
        // Determine timestamp - prefer createdAt from metadata, fall back to db file mtime
        let createdAt = null;
        if (metadata.createdAt) {
          createdAt = new Date(metadata.createdAt).toISOString();
        } else if (dbStatMtimeMs) {
          createdAt = new Date(dbStatMtimeMs).toISOString();
        } else {
          createdAt = new Date().toISOString();
        }
        
        sessions.push({
          id: sessionId,
          name: sessionName,
          createdAt: createdAt,
          lastActivity: createdAt, // For compatibility with Claude sessions
          messageCount: messageCountResult.count || 0,
          projectPath: projectPath
        });
        
      } catch (error) {
        console.warn(`Could not read Cursor session ${sessionId}:`, error.message);
      }
    }
    
    // Sort sessions by creation time (newest first)
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Return only the first 5 sessions for performance
    return sessions.slice(0, 5);
    
  } catch (error) {
    console.error('Error fetching Cursor sessions:', error);
    return [];
  }
}


export {
  getProjects,
  getSessions,
  getSessionMessages,
  renameProject,
  deleteSession,
  isProjectEmpty,
  deleteProject,
  addProjectManually,
  removeProjectFromBrowser,
  loadProjectConfig,
  saveProjectConfig,
  extractProjectDirectory,
  clearProjectDirectoryCache
};
