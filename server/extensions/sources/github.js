import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import ExtensionValidator from '../validator.js';

/**
 * GitHub Source Handler for Extension Installation
 * Handles fetching and installing extensions from GitHub repositories
 */
class GitHubSourceHandler {
  constructor() {
    this.apiBaseUrl = 'https://api.github.com';
    this.rawBaseUrl = 'https://raw.githubusercontent.com';
  }

  /**
   * Parse GitHub URL to extract owner, repo, and file path
   */
  parseGitHubUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Handle various GitHub URL formats
      if (urlObj.hostname === 'github.com') {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        const owner = pathParts[0];
        const repo = pathParts[1];
        
        if (pathParts[2] === 'blob' || pathParts[2] === 'raw') {
          // Direct file URL: https://github.com/owner/repo/blob/branch/path/to/file
          const branch = pathParts[3] || 'main';
          const filePath = pathParts.slice(4).join('/');
          return { owner, repo, branch, filePath, type: 'file' };
        } else if (pathParts.length === 2) {
          // Repository URL: https://github.com/owner/repo
          return { owner, repo, branch: 'main', filePath: '', type: 'repo' };
        }
      } else if (urlObj.hostname === 'raw.githubusercontent.com') {
        // Raw URL: https://raw.githubusercontent.com/owner/repo/branch/path/to/file
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        const owner = pathParts[0];
        const repo = pathParts[1];
        const branch = pathParts[2];
        const filePath = pathParts.slice(3).join('/');
        return { owner, repo, branch, filePath, type: 'file' };
      }
      
      throw new Error('Invalid GitHub URL format');
    } catch (error) {
      throw new Error(`Failed to parse GitHub URL: ${error.message}`);
    }
  }

  /**
   * Fetch repository contents from GitHub API
   */
  async fetchRepoContents(owner, repo, path = '', branch = 'main') {
    try {
      const url = `${this.apiBaseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository or path not found');
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to fetch repository contents: ${error.message}`);
    }
  }

  /**
   * Fetch raw file content from GitHub
   */
  async fetchRawFile(owner, repo, filePath, branch = 'main') {
    try {
      const url = `${this.rawBaseUrl}/${owner}/${repo}/${branch}/${filePath}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('File not found');
        }
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to fetch raw file: ${error.message}`);
    }
  }

  /**
   * Discover extensions in a repository
   */
  async discoverExtensions(owner, repo, branch = 'main') {
    const extensions = [];
    
    try {
      // Look for common extension directories and files
      const searchPaths = [
        '', // Root directory
        'agents',
        'extensions', 
        'claude-agents',
        '.claude/agents',
        'src/agents'
      ];

      for (const searchPath of searchPaths) {
        try {
          const contents = await this.fetchRepoContents(owner, repo, searchPath, branch);
          
          if (Array.isArray(contents)) {
            // Directory contents
            for (const item of contents) {
              if (item.type === 'file' && this.isExtensionFile(item.name)) {
                extensions.push({
                  name: this.getNameFromFilename(item.name),
                  path: item.path,
                  downloadUrl: item.download_url,
                  type: this.getExtensionTypeFromFilename(item.name),
                  size: item.size
                });
              }
            }
          } else if (contents.type === 'file' && this.isExtensionFile(contents.name)) {
            // Single file
            extensions.push({
              name: this.getNameFromFilename(contents.name),
              path: contents.path,
              downloadUrl: contents.download_url,
              type: this.getExtensionTypeFromFilename(contents.name),
              size: contents.size
            });
          }
        } catch (error) {
          // Continue searching other paths if one fails
          continue;
        }
      }

      return extensions;
    } catch (error) {
      throw new Error(`Failed to discover extensions: ${error.message}`);
    }
  }

  /**
   * Install extension from GitHub
   */
  async installFromGitHub(githubUrl, installOptions = {}) {
    const {
      name,
      description,
      classification = 'selectable',
      version = '1.0.0',
      author,
      targetDirectory
    } = installOptions;

    try {
      // Parse GitHub URL  
      const { owner, repo, branch, filePath, type } = this.parseGitHubUrl(githubUrl);
      
      let extensionContent;
      let extensionPath;
      let detectedName = name;
      
      if (type === 'file' && filePath) {
        // Direct file installation
        extensionContent = await this.fetchRawFile(owner, repo, filePath, branch);
        extensionPath = filePath;
        
        if (!detectedName) {
          detectedName = this.getNameFromFilename(path.basename(filePath));
        }
      } else if (type === 'repo') {
        // Repository discovery
        const extensions = await this.discoverExtensions(owner, repo, branch);
        
        if (extensions.length === 0) {
          throw new Error('No extensions found in repository');
        }
        
        // If multiple extensions found, prefer the first one or let user choose
        const selectedExtension = extensions[0];
        extensionContent = await fetch(selectedExtension.downloadUrl).then(r => r.text());
        extensionPath = selectedExtension.path;
        
        if (!detectedName) {
          detectedName = selectedExtension.name;
        }
      } else {
        throw new Error('Invalid GitHub URL format');
      }

      // Validate the extension content
      const validation = await this.validateExtensionContent(extensionContent, extensionPath);
      if (!validation.valid) {
        throw new Error(`Extension validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate extension metadata
      const extensionId = crypto.randomUUID();
      const fileName = `${extensionId}${path.extname(extensionPath)}`;
      
      // Save to target directory
      const finalPath = path.join(targetDirectory, fileName);
      await fs.mkdir(path.dirname(finalPath), { recursive: true });
      await fs.writeFile(finalPath, extensionContent, 'utf8');

      return {
        id: extensionId,
        name: detectedName,
        description: description || validation.data?.metadata?.description || `Extension from ${owner}/${repo}`,
        version: version,
        type: validation.type,
        classification: classification,
        source: 'github',
        source_url: githubUrl,
        file_path: finalPath,
        config: JSON.stringify(validation.data?.metadata || {}),
        author: author || owner,
        metadata: {
          repository: `${owner}/${repo}`,
          branch: branch,
          originalPath: extensionPath,
          hash: validation.data?.hash
        }
      };

    } catch (error) {
      throw new Error(`GitHub installation failed: ${error.message}`);
    }
  }

  /**
   * Validate extension content
   */
  async validateExtensionContent(content, filePath) {
    // Create a temporary file for validation
    const tempDir = path.join(process.cwd(), 'temp', 'validation');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFile = path.join(tempDir, path.basename(filePath));
    await fs.writeFile(tempFile, content, 'utf8');
    
    try {
      const validation = await ExtensionValidator.validateExtension(tempFile);
      return validation;
    } finally {
      // Cleanup temp file
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Check if file is a valid extension file
   */
  isExtensionFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    const basename = path.basename(filename, ext).toLowerCase();
    
    // Agent files
    if (ext === '.md' || ext === '.markdown') {
      return !basename.includes('readme') && !basename.includes('changelog');
    }
    
    // Command files
    if (ext === '.txt' || ext === '.cmd') {
      return true;
    }
    
    // Hook files
    if (ext === '.json' && basename.includes('hook')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get extension type from filename
   */
  getExtensionTypeFromFilename(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    if (ext === '.md' || ext === '.markdown') {
      return 'agent';
    }
    if (ext === '.txt' || ext === '.cmd') {
      return 'command';
    }
    if (ext === '.json') {
      return 'hook';
    }
    
    return 'unknown';
  }

  /**
   * Get name from filename
   */
  getNameFromFilename(filename) {
    return path.basename(filename, path.extname(filename))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * List popular extension repositories
   */
  async getPopularRepositories() {
    // This could be enhanced to search GitHub for repositories with extension content
    return [
      {
        owner: 'anthropics',
        repo: 'claude-extensions',
        description: 'Official Claude Extensions Repository',
        stars: 0,
        url: 'https://github.com/anthropics/claude-extensions'
      }
      // Add more popular repositories here
    ];
  }

  /**
   * Search GitHub for extension repositories
   */
  async searchRepositories(query, limit = 10) {
    try {
      const searchUrl = `${this.apiBaseUrl}/search/repositories?q=${encodeURIComponent(query + ' claude extension')}&sort=stars&order=desc&per_page=${limit}`;
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`GitHub search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.items.map(repo => ({
        owner: repo.owner.login,
        repo: repo.name,
        description: repo.description,
        stars: repo.stargazers_count,
        url: repo.html_url,
        language: repo.language,
        updatedAt: repo.updated_at
      }));
    } catch (error) {
      throw new Error(`Repository search failed: ${error.message}`);
    }
  }
}

export default GitHubSourceHandler;