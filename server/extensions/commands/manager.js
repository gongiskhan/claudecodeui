import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Command Manager for Claude Code slash commands
 * Handles commands in .claude/commands/ directories
 */
export class CommandManager {
  constructor(projectPath = null) {
    this.projectPath = projectPath || process.cwd();
    this.globalCommandsPath = path.join(os.homedir(), '.claude', 'commands');
    this.projectCommandsPath = path.join(this.projectPath, '.claude', 'commands');
  }

  /**
   * Initialize command directories
   */
  async initializeDirectories() {
    await fs.mkdir(this.globalCommandsPath, { recursive: true });
    await fs.mkdir(this.projectCommandsPath, { recursive: true });
  }

  /**
   * Get all available commands from both global and project directories
   */
  async getAllCommands() {
    const commands = [];
    
    // Load global commands
    const globalCommands = await this.loadCommandsFromDirectory(this.globalCommandsPath, 'user');
    commands.push(...globalCommands);

    // Load project commands
    const projectCommands = await this.loadCommandsFromDirectory(this.projectCommandsPath, 'selectable');
    commands.push(...projectCommands);

    return commands;
  }

  /**
   * Load commands from a specific directory
   */
  async loadCommandsFromDirectory(dirPath, classification, parentPath = '') {
    const commands = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.join(parentPath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively load commands from subdirectories
          const subCommands = await this.loadCommandsFromDirectory(fullPath, classification, relativePath);
          commands.push(...subCommands);
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
          // Load command from file
          const command = await this.loadCommandFromFile(fullPath, classification, relativePath);
          if (command) {
            commands.push(command);
          }
        }
      }
    } catch (error) {
      console.error(`Error loading commands from ${dirPath}:`, error);
    }
    
    return commands;
  }

  /**
   * Load a single command from a file
   */
  async loadCommandFromFile(filePath, classification, relativePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath, path.extname(filePath));
      
      // Parse command name from path (e.g., project/frontend/component -> /project:frontend:component)
      const pathParts = relativePath.split(path.sep);
      pathParts[pathParts.length - 1] = fileName;
      const commandName = '/' + pathParts.join(':');
      
      // Generate unique ID
      const id = crypto.createHash('md5').update(filePath).digest('hex');
      
      // Extract description from first line if it's a comment
      let description = '';
      const lines = content.split('\n');
      if (lines[0].startsWith('#') || lines[0].startsWith('//')) {
        description = lines[0].replace(/^[#\/]+\s*/, '').trim();
      }
      
      return {
        id,
        name: commandName,
        description: description || `Command ${commandName}`,
        type: 'command',
        classification,
        version: '1.0.0',
        source: 'local',
        file_path: filePath,
        template: content,
        config: JSON.stringify({
          template: content,
          uses_arguments: content.includes('$ARGUMENTS')
        }),
        status: 'enabled',
        tags: this.extractTags(content)
      };
    } catch (error) {
      console.error(`Error loading command from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extract tags from command content
   */
  extractTags(content) {
    const tags = [];
    
    // Look for common patterns
    if (content.match(/test|spec|unit/i)) tags.push('testing');
    if (content.match(/refactor|improve|clean/i)) tags.push('refactoring');
    if (content.match(/debug|fix|error/i)) tags.push('debugging');
    if (content.match(/document|docs|readme/i)) tags.push('documentation');
    if (content.match(/analyze|review|audit/i)) tags.push('analysis');
    if (content.match(/security|vulnerability|auth/i)) tags.push('security');
    if (content.match(/performance|optimize|speed/i)) tags.push('performance');
    
    return tags;
  }

  /**
   * Save a new command to file
   */
  async saveCommand(commandData, scope = 'project') {
    const { name, template, description } = commandData;
    
    // Parse command path (e.g., /project:frontend:component -> project/frontend/component.md)
    const nameParts = name.replace(/^\//, '').split(':');
    const fileName = nameParts.pop() + '.md';
    const subPath = nameParts.join(path.sep);
    
    // Determine target directory
    const baseDir = scope === 'user' ? this.globalCommandsPath : this.projectCommandsPath;
    const targetDir = path.join(baseDir, subPath);
    const filePath = path.join(targetDir, fileName);
    
    // Create directory if needed
    await fs.mkdir(targetDir, { recursive: true });
    
    // Prepare content with description as first line comment
    let content = template;
    if (description && !template.startsWith('#')) {
      content = `# ${description}\n\n${template}`;
    }
    
    // Write command to file
    await fs.writeFile(filePath, content, 'utf8');
    
    return filePath;
  }

  /**
   * Delete a command
   */
  async deleteCommand(commandId) {
    // Find command by ID
    const commands = await this.getAllCommands();
    const command = commands.find(cmd => cmd.id === commandId);
    
    if (!command || !command.file_path) {
      throw new Error('Command not found');
    }
    
    // Delete the file
    await fs.unlink(command.file_path);
    
    // Clean up empty directories
    await this.cleanupEmptyDirectories(path.dirname(command.file_path));
  }

  /**
   * Clean up empty directories
   */
  async cleanupEmptyDirectories(dirPath) {
    try {
      const entries = await fs.readdir(dirPath);
      if (entries.length === 0) {
        await fs.rmdir(dirPath);
        
        // Recursively clean parent if it's within command directories
        const parent = path.dirname(dirPath);
        if (parent.includes('.claude/commands')) {
          await this.cleanupEmptyDirectories(parent);
        }
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Import commands from a source
   */
  async importCommands(commands, scope = 'user') {
    const imported = [];
    
    for (const command of commands) {
      try {
        const filePath = await this.saveCommand({
          name: command.name,
          template: command.template || command.content,
          description: command.description
        }, scope);
        
        imported.push({
          ...command,
          file_path: filePath,
          status: 'imported'
        });
      } catch (error) {
        console.error(`Failed to import command ${command.name}:`, error);
      }
    }
    
    return imported;
  }
}

export default CommandManager;