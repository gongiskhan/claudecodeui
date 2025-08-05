import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Extension Management System
 * Handles file system operations for the three-tier classification system
 */
class ExtensionManager {
  constructor() {
    this.globalClaudeDir = path.join(os.homedir(), '.claude');
    this.projectClaudeDir = path.join(process.cwd(), '.claude');
  }

  /**
   * Initialize extension directory structure
   * Creates both global and project-level .claude directories
   */
  async initializeExtensionDirectories() {
    const globalStructure = {
      'config': {
        'global.json': JSON.stringify({
          version: '1.0.0',
          extensionSettings: {
            autoUpdate: true,
            allowUntrusted: false,
            maxResourceUsage: {
              cpu: '50%',
              memory: '512MB',
              disk: '1GB'
            }
          }
        }, null, 2),
        'extensions.json': JSON.stringify({
          version: '1.0.0',
          extensions: {},
          lastUpdate: new Date().toISOString()
        }, null, 2),
        'security.json': JSON.stringify({
          version: '1.0.0',
          policies: {
            requireSignatures: true,
            allowedSources: ['github', 'npm', 'local'],
            sandboxing: {
              enabled: true,
              resourceLimits: true,
              networkAccess: 'restricted'
            }
          }
        }, null, 2)
      },
      'agents': {
        'registry.json': JSON.stringify({
          version: '1.0.0',
          agents: {},
          classifications: {
            selectable: [],
            default: [],
            user: []
          },
          lastUpdate: new Date().toISOString()
        }, null, 2),
        'installed': {},
        'cache': {}
      },
      'commands': {
        'registry.json': JSON.stringify({
          version: '1.0.0',
          commands: {},
          scopes: {
            global: [],
            user: []
          },
          lastUpdate: new Date().toISOString()
        }, null, 2),
        'user': {}
      },
      'hooks': {
        'definitions': {}
      }
    };

    const projectStructure = {
      'config': {
        'project.json': JSON.stringify({
          version: '1.0.0',
          projectId: path.basename(process.cwd()),
          extensionSettings: {
            inheritGlobal: true,
            overrides: {}
          },
          lastUpdate: new Date().toISOString()
        }, null, 2)
      },
      'agents': {
        'enabled.json': JSON.stringify({
          version: '1.0.0',
          enabled: [],
          disabled: [],
          configurations: {},
          lastUpdate: new Date().toISOString()
        }, null, 2),
        'local': {}
      },
      'commands': {},
      'hooks': {}
    };

    // Create global structure
    await this.createDirectoryStructure(this.globalClaudeDir, globalStructure);
    
    // Create project structure
    await this.createDirectoryStructure(this.projectClaudeDir, projectStructure);
  }

  /**
   * Recursively create directory structure with files
   */
  async createDirectoryStructure(basePath, structure) {
    await fs.mkdir(basePath, { recursive: true });

    for (const [name, content] of Object.entries(structure)) {
      const fullPath = path.join(basePath, name);
      
      if (typeof content === 'string') {
        // It's a file
        await fs.writeFile(fullPath, content, 'utf8');
      } else {
        // It's a directory
        await this.createDirectoryStructure(fullPath, content);
      }
    }
  }

  /**
   * Check if extension directories exist
   */
  async checkExtensionDirectories() {
    try {
      const globalExists = await fs.access(this.globalClaudeDir).then(() => true).catch(() => false);
      const projectExists = await fs.access(this.projectClaudeDir).then(() => true).catch(() => false);
      
      return { globalExists, projectExists };
    } catch (error) {
      return { globalExists: false, projectExists: false };
    }
  }

  /**
   * Get extension configuration
   */
  async getExtensionConfig(scope = 'global') {
    const configPath = scope === 'global' 
      ? path.join(this.globalClaudeDir, 'config', 'extensions.json')
      : path.join(this.projectClaudeDir, 'config', 'project.json');

    try {
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to read extension config: ${error.message}`);
      return null;
    }
  }

  /**
   * Update extension configuration
   */
  async updateExtensionConfig(config, scope = 'global') {
    const configPath = scope === 'global' 
      ? path.join(this.globalClaudeDir, 'config', 'extensions.json')
      : path.join(this.projectClaudeDir, 'config', 'project.json');

    try {
      config.lastUpdate = new Date().toISOString();
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Failed to update extension config: ${error.message}`);
      return false;
    }
  }

  /**
   * Get paths for different extension types
   */
  getPaths() {
    return {
      global: {
        config: path.join(this.globalClaudeDir, 'config'),
        agents: path.join(this.globalClaudeDir, 'agents'),
        commands: path.join(this.globalClaudeDir, 'commands'),
        hooks: path.join(this.globalClaudeDir, 'hooks')
      },
      project: {
        config: path.join(this.projectClaudeDir, 'config'),
        agents: path.join(this.projectClaudeDir, 'agents'),
        commands: path.join(this.projectClaudeDir, 'commands'),
        hooks: path.join(this.projectClaudeDir, 'hooks')
      }
    };
  }
}

export default ExtensionManager;