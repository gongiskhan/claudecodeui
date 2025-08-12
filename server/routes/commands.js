import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { CommandManager } from '../extensions/commands/manager.js';
import { CommandSourcesHandler } from '../extensions/commands/sources.js';

const router = express.Router();

/**
 * GET /api/v1/commands
 * List all commands from .claude/commands directories
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { project_path, search, classification } = req.query;
    
    const commandManager = new CommandManager(project_path);
    await commandManager.initializeDirectories();
    
    let commands = await commandManager.getAllCommands();
    
    // Filter by classification if provided
    if (classification) {
      commands = commands.filter(cmd => cmd.classification === classification);
    }
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      commands = commands.filter(cmd => 
        cmd.name.toLowerCase().includes(searchLower) ||
        cmd.description.toLowerCase().includes(searchLower) ||
        (cmd.tags && cmd.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }
    
    res.json({
      commands,
      total: commands.length
    });
  } catch (error) {
    console.error('Error listing commands:', error);
    res.status(500).json({ 
      error: 'Failed to list commands',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/commands/sources
 * Get available command sources
 */
router.get('/sources', authenticateToken, async (req, res) => {
  try {
    const sourcesHandler = new CommandSourcesHandler();
    const sources = sourcesHandler.getSources();
    
    res.json({ sources });
  } catch (error) {
    console.error('Error getting command sources:', error);
    res.status(500).json({ 
      error: 'Failed to get command sources',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/commands/sources/:sourceId
 * Fetch commands from a specific source
 */
router.get('/sources/:sourceId', authenticateToken, async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { search, tags } = req.query;
    
    const sourcesHandler = new CommandSourcesHandler();
    
    if (search) {
      // Search across the source
      const results = await sourcesHandler.searchCommands(search, {
        sources: [sourceId],
        tags: tags ? tags.split(',') : []
      });
      res.json({ commands: results });
    } else {
      // Fetch all from source
      const commands = await sourcesHandler.fetchFromSource(sourceId);
      res.json({ commands });
    }
  } catch (error) {
    console.error(`Error fetching from source ${req.params.sourceId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch commands from source',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/commands
 * Create a new command
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, template, description, classification = 'selectable', project_path } = req.body;
    
    if (!name || !template) {
      return res.status(400).json({ error: 'Name and template are required' });
    }
    
    // Validate name format (should start with /)
    if (!name.startsWith('/')) {
      return res.status(400).json({ error: 'Command name must start with /' });
    }
    
    const commandManager = new CommandManager(project_path);
    const scope = classification === 'user' ? 'user' : 'project';
    
    const filePath = await commandManager.saveCommand({
      name,
      template,
      description
    }, scope);
    
    // Return the created command
    const commands = await commandManager.getAllCommands();
    const createdCommand = commands.find(cmd => cmd.file_path === filePath);
    
    res.status(201).json({ 
      command: createdCommand,
      message: 'Command created successfully' 
    });
  } catch (error) {
    console.error('Error creating command:', error);
    res.status(500).json({ 
      error: 'Failed to create command',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/commands/import
 * Import commands from a source
 */
router.post('/import', authenticateToken, async (req, res) => {
  try {
    const { sourceId, commandIds, scope = 'user', project_path } = req.body;
    
    if (!sourceId || !commandIds || !Array.isArray(commandIds)) {
      return res.status(400).json({ error: 'sourceId and commandIds array are required' });
    }
    
    const sourcesHandler = new CommandSourcesHandler();
    const commandManager = new CommandManager(project_path);
    
    // Fetch all commands from source
    const sourceCommands = await sourcesHandler.fetchFromSource(sourceId);
    
    // Filter selected commands
    const selectedCommands = sourceCommands.filter(cmd => 
      commandIds.includes(cmd.name) || commandIds.includes(cmd.id)
    );
    
    if (selectedCommands.length === 0) {
      return res.status(404).json({ error: 'No matching commands found' });
    }
    
    // Import commands
    const imported = await commandManager.importCommands(selectedCommands, scope);
    
    res.json({ 
      imported: imported.length,
      commands: imported,
      message: `Successfully imported ${imported.length} commands` 
    });
  } catch (error) {
    console.error('Error importing commands:', error);
    res.status(500).json({ 
      error: 'Failed to import commands',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/v1/commands/:id
 * Delete a command
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { project_path } = req.query;
    
    const commandManager = new CommandManager(project_path);
    await commandManager.deleteCommand(id);
    
    res.json({ message: 'Command deleted successfully' });
  } catch (error) {
    console.error('Error deleting command:', error);
    res.status(500).json({ 
      error: 'Failed to delete command',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/commands/:id/execute
 * Log command execution (for tracking)
 */
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { project_path, arguments: args, execution_time, status } = req.body;
    
    // Log execution to database if needed
    const db = req.app.locals.db;
    const stmt = db.prepare(`
      INSERT INTO extension_logs (
        extension_id, project_path, event_type, status, 
        execution_time, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(
      id,
      project_path || null,
      'command_execution',
      status || 'success',
      execution_time || 0,
      JSON.stringify({ arguments: args })
    );
    
    res.json({ message: 'Execution logged successfully' });
  } catch (error) {
    console.error('Error logging command execution:', error);
    // Don't fail the request just for logging
    res.json({ message: 'Execution completed (logging failed)' });
  }
});

export default router;