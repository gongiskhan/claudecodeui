import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import readline from 'readline';

const sessionCache = new Map();
const projectCache = new Map();

// Function to get sessions for a project, with caching
async function getSessionsForProject(projectName) {
  if (projectCache.has(projectName)) {
    return projectCache.get(projectName);
  }

  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  try {
    await fs.access(projectDir);
  } catch (error) {
    return []; // Project directory does not exist
  }

  const files = await fs.readdir(projectDir);
  const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
  const allSessions = new Map();

  for (const file of jsonlFiles) {
    const filePath = path.join(projectDir, file);
    const sessions = await parseJsonlSessions(filePath);
    sessions.forEach(session => {
      if (!allSessions.has(session.id)) {
        allSessions.set(session.id, session);
      }
    });
  }

  const sortedSessions = Array.from(allSessions.values()).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  projectCache.set(projectName, sortedSessions);
  return sortedSessions;
}

// Function to get a single session's messages, with caching
async function getSession(projectName, sessionId) {
  const cacheKey = `${projectName}:${sessionId}`;
  if (sessionCache.has(cacheKey)) {
    return sessionCache.get(cacheKey);
  }

  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  const messages = [];
  try {
    await fs.access(projectDir);
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const filePath = path.join(projectDir, file);
      const fileStream = fsSync.createReadStream(filePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line);
            if (entry.sessionId === sessionId) {
              messages.push(entry);
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    }
  } catch (error) {
    // ignore directory not found errors
  }

  const sortedMessages = messages.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
  if (sortedMessages.length > 0) {
    sessionCache.set(cacheKey, sortedMessages);
  }
  return sortedMessages;
}

function invalidateCacheForProject(projectName) {
  if (projectCache.has(projectName)) {
    projectCache.delete(projectName);
    console.log(`Cache invalidated for project: ${projectName}`);
  }

  const sessionsToDelete = [];
  for (const key of sessionCache.keys()) {
    if (key.startsWith(`${projectName}:`)) {
      sessionsToDelete.push(key);
    }
  }

  if (sessionsToDelete.length > 0) {
    sessionsToDelete.forEach(key => sessionCache.delete(key));
    console.log(`Invalidated ${sessionsToDelete.length} session caches for project ${projectName}.`);
  }
}

async function parseJsonlSessions(filePath) {
  const sessions = new Map();
  const fileStream = fsSync.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const entry = JSON.parse(line);
        if (entry.sessionId) {
          if (!sessions.has(entry.sessionId)) {
            sessions.set(entry.sessionId, {
              id: entry.sessionId,
              summary: 'New Session',
              messageCount: 0,
              lastActivity: new Date(0),
              cwd: entry.cwd || '',
            });
          }
          const session = sessions.get(entry.sessionId);
          if (entry.type === 'summary' && entry.summary) {
            session.summary = entry.summary;
          } else if (entry.message?.role === 'user' && entry.message?.content && session.summary === 'New Session') {
            const content = entry.message.content;
            if (typeof content === 'string' && content.length > 0 && !content.startsWith('<command-name>')) {
              session.summary = content.length > 50 ? content.substring(0, 50) + '...' : content;
            }
          }
          session.messageCount++;
          if (entry.timestamp) {
            const entryDate = new Date(entry.timestamp);
            if (entryDate > session.lastActivity) {
              session.lastActivity = entryDate;
            }
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }
  return Array.from(sessions.values());
}

export {
  getSessionsForProject,
  getSession,
  invalidateCacheForProject,
};
