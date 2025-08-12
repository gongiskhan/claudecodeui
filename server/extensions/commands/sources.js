import fetch from 'node-fetch';

/**
 * Command Sources Handler
 * Fetches commands from various online sources
 */
export class CommandSourcesHandler {
  constructor() {
    this.sources = [
      {
        id: 'claude-command-suite',
        name: 'Claude Command Suite',
        description: '119+ custom slash commands and 54 intelligent AI agents by qdhenry',
        url: 'https://api.github.com/repos/qdhenry/Claude-Command-Suite/contents/commands',
        type: 'github',
        author: 'qdhenry',
        stats: { commands: 119, agents: 54 }
      },
      {
        id: 'awesome-claude-code',
        name: 'Awesome Claude Code',
        description: 'Community hub with 60+ commands across various categories',
        url: 'https://api.github.com/repos/hesreallyhim/awesome-claude-code/contents/commands',
        type: 'github',
        author: 'hesreallyhim',
        stats: { commands: 60 }
      },
      {
        id: 'claude-code-subagents',
        name: 'Claude Code Subagents Collection',
        description: '39+ slash commands with 36+ specialized AI subagents',
        url: 'https://api.github.com/repos/davepoon/claude-code-subagents-collection/contents/commands',
        type: 'github',
        author: 'davepoon',
        stats: { commands: 39, agents: 36 }
      },
      {
        id: 'wcygan-megalist',
        name: 'WCygan Megalist',
        description: '88 commands for agent orchestration and project management',
        url: 'https://api.github.com/repos/wcygan/claude-code-commands/contents',
        type: 'github',
        author: 'wcygan',
        stats: { commands: 88 }
      },
      {
        id: 'wshobson-commands',
        name: 'WShobson Commands',
        description: 'Production-ready workflow commands',
        url: 'https://api.github.com/repos/wshobson/commands/contents',
        type: 'github',
        author: 'wshobson',
        stats: { commands: 25 }
      },
      {
        id: 'hikarubw-commands',
        name: 'Hikarubw Commands',
        description: 'Quality commands with ultrathink mode for deep analysis',
        url: 'https://api.github.com/repos/hikarubw/claude-commands/contents',
        type: 'github',
        author: 'hikarubw',
        stats: { commands: 6 }
      },
      {
        id: 'builderio-templates',
        name: 'Builder.io Templates',
        description: 'Professional command templates from Builder.io',
        url: 'https://raw.githubusercontent.com/BuilderIO/claude-code-templates/main/commands.json',
        type: 'json',
        author: 'Builder.io'
      },
      {
        id: 'claude-code-hub',
        name: 'Claude Code Hub',
        description: 'Central repository of community-contributed commands',
        url: 'https://api.github.com/repos/claude-code-hub/commands/contents',
        type: 'github',
        author: 'Community'
      }
    ];
  }

  /**
   * Get all available sources
   */
  getSources() {
    return this.sources;
  }

  /**
   * Fetch commands from a specific source
   */
  async fetchFromSource(sourceId) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) {
      throw new Error('Source not found');
    }

    try {
      switch (source.type) {
        case 'github':
          return await this.fetchFromGitHub(source);
        case 'json':
          return await this.fetchFromJSON(source);
        default:
          throw new Error(`Unsupported source type: ${source.type}`);
      }
    } catch (error) {
      console.error(`Error fetching from source ${sourceId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch commands from GitHub repository
   */
  async fetchFromGitHub(source) {
    const response = await fetch(source.url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClaudeCodeUI'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const files = await response.json();
    const commands = [];

    // Process each file
    for (const file of files) {
      if (file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
        try {
          const contentResponse = await fetch(file.download_url);
          if (contentResponse.ok) {
            const content = await contentResponse.text();
            const commandName = this.parseCommandName(file.name, file.path);
            
            commands.push({
              name: commandName,
              description: this.extractDescription(content),
              template: content,
              source: source.name,
              source_url: file.html_url,
              author: source.author,
              tags: this.extractTags(content)
            });
          }
        } catch (error) {
          console.error(`Error fetching command ${file.name}:`, error);
        }
      } else if (file.type === 'dir') {
        // Recursively fetch from subdirectories
        try {
          const subCommands = await this.fetchFromGitHub({
            ...source,
            url: file.url
          });
          commands.push(...subCommands);
        } catch (error) {
          console.error(`Error fetching from subdirectory ${file.name}:`, error);
        }
      }
    }

    return commands;
  }

  /**
   * Fetch commands from JSON endpoint
   */
  async fetchFromJSON(source) {
    const response = await fetch(source.url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.status}`);
    }

    const data = await response.json();
    const commands = [];

    // Process JSON data
    if (Array.isArray(data)) {
      for (const item of data) {
        commands.push({
          name: item.name || item.command,
          description: item.description,
          template: item.template || item.content,
          source: source.name,
          source_url: source.url,
          author: source.author || item.author,
          tags: item.tags || this.extractTags(item.template || item.content || '')
        });
      }
    } else if (data.commands) {
      // Handle wrapped commands
      return this.fetchFromJSON({ ...source, url: data.commands });
    }

    return commands;
  }

  /**
   * Parse command name from file path
   */
  parseCommandName(fileName, filePath) {
    // Remove extension
    const baseName = fileName.replace(/\.(md|txt)$/, '');
    
    // Convert path to command format
    const pathParts = filePath.split('/');
    const relevantParts = [];
    
    // Skip common directory names
    const skipDirs = ['commands', 'src', 'content'];
    for (const part of pathParts) {
      if (!skipDirs.includes(part) && part !== fileName) {
        relevantParts.push(part);
      }
    }
    
    // Add the base name
    relevantParts.push(baseName);
    
    // Convert to command format
    return '/' + relevantParts.join(':').replace(/-/g, '_');
  }

  /**
   * Extract description from content
   */
  extractDescription(content) {
    const lines = content.split('\n');
    
    // Look for description in first few lines
    for (const line of lines.slice(0, 5)) {
      // Check for markdown header
      if (line.startsWith('#') && !line.startsWith('##')) {
        return line.replace(/^#+\s*/, '').trim();
      }
      // Check for comment
      if (line.startsWith('//') || line.startsWith('/*')) {
        return line.replace(/^[\/\*]+\s*/, '').trim();
      }
    }
    
    // Use first non-empty line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('---')) {
        return trimmed.substring(0, 100) + (trimmed.length > 100 ? '...' : '');
      }
    }
    
    return 'Command template';
  }

  /**
   * Extract tags from content
   */
  extractTags(content) {
    const tags = [];
    const lowerContent = content.toLowerCase();
    
    // Common tag patterns
    const tagPatterns = {
      'testing': /test|spec|unit|integration/,
      'refactoring': /refactor|improve|clean|optimize/,
      'debugging': /debug|fix|error|bug|issue/,
      'documentation': /document|docs|readme|comment/,
      'analysis': /analyze|review|audit|inspect/,
      'security': /security|vulnerability|auth|permission/,
      'performance': /performance|optimize|speed|fast/,
      'api': /api|endpoint|rest|graphql/,
      'frontend': /react|vue|angular|component|ui/,
      'backend': /server|database|api|node|express/,
      'deployment': /deploy|release|build|ci|cd/,
      'git': /git|commit|branch|merge/
    };
    
    for (const [tag, pattern] of Object.entries(tagPatterns)) {
      if (pattern.test(lowerContent)) {
        tags.push(tag);
      }
    }
    
    return tags;
  }

  /**
   * Search commands across all sources
   */
  async searchCommands(query, filters = {}) {
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    // Fetch from selected sources or all
    const sourcesToSearch = filters.sources || this.sources.map(s => s.id);
    
    for (const sourceId of sourcesToSearch) {
      try {
        const commands = await this.fetchFromSource(sourceId);
        
        // Filter commands
        const filtered = commands.filter(cmd => {
          // Search in name, description, and content
          const searchText = `${cmd.name} ${cmd.description} ${cmd.template}`.toLowerCase();
          
          if (!searchText.includes(lowerQuery)) {
            return false;
          }
          
          // Apply tag filters
          if (filters.tags && filters.tags.length > 0) {
            const hasTag = filters.tags.some(tag => cmd.tags.includes(tag));
            if (!hasTag) return false;
          }
          
          return true;
        });
        
        results.push(...filtered);
      } catch (error) {
        console.error(`Error searching source ${sourceId}:`, error);
      }
    }
    
    return results;
  }
}

export default CommandSourcesHandler;