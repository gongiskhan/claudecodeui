import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import ExtensionManager from '../extensions/manager.js';
import HookEventProcessor from '../extensions/hooks/processor.js';
import HookTemplateLibrary from '../extensions/hooks/templates.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Initialize hook system components
let extensionManager;
let hookProcessor;
let templateLibrary;

// Initialize middleware
router.use((req, res, next) => {
  if (!extensionManager) {
    extensionManager = new ExtensionManager();
  }
  if (!hookProcessor) {
    hookProcessor = new HookEventProcessor(req.app.locals.db, extensionManager);
  }
  if (!templateLibrary) {
    templateLibrary = new HookTemplateLibrary();
  }
  next();
});

/**
 * GET /api/v1/hooks
 * List all hooks with optional filtering
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      event, 
      enabled, 
      project_path,
      search,
      limit = 50,
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        h.*,
        COUNT(l.id) as execution_count,
        AVG(l.execution_time) as avg_duration,
        MAX(l.created_at) as last_execution,
        SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) as success_count
      FROM hooks h
      LEFT JOIN hook_logs l ON h.id = l.hook_id AND l.event_type = 'execution'
      WHERE 1=1
    `;
    
    const params = [];

    if (event) {
      query += ' AND h.event = ?';
      params.push(event);
    }

    if (enabled !== undefined) {
      query += ' AND h.enabled = ?';
      params.push(enabled === 'true' ? 1 : 0);
    }

    if (project_path) {
      query += ' AND (h.project_path = ? OR h.project_path IS NULL)';
      params.push(project_path);
    }

    if (search) {
      query += ' AND (h.name LIKE ? OR h.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += `
      GROUP BY h.id, h.name, h.description, h.event, h.condition, h.command, h.timeout, h.enabled, h.project_path, h.created_at, h.updated_at
      ORDER BY h.enabled DESC, h.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), parseInt(offset));

    const stmt = req.app.locals.db.prepare(query);
    const hooks = stmt.all(...params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM hooks h WHERE 1=1`;
    const countParams = [];

    if (event) {
      countQuery += ' AND h.event = ?';
      countParams.push(event);
    }
    if (enabled !== undefined) {
      countQuery += ' AND h.enabled = ?';
      countParams.push(enabled === 'true' ? 1 : 0);
    }
    if (project_path) {
      countQuery += ' AND (h.project_path = ? OR h.project_path IS NULL)';
      countParams.push(project_path);
    }
    if (search) {
      countQuery += ' AND (h.name LIKE ? OR h.description LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countStmt = req.app.locals.db.prepare(countQuery);
    const { total } = countStmt.get(...countParams);

    // Determine hook status based on recent executions
    const processedHooks = hooks.map(hook => ({
      ...hook,
      status: hook.enabled ? 'active' : 'disabled'
    }));

    res.json({
      hooks: processedHooks,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      },
      filters: {
        event,
        enabled,
        project_path,
        search
      }
    });

  } catch (error) {
    console.error('Error listing hooks:', error);
    res.status(500).json({ 
      error: 'Failed to list hooks',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/hooks/:id
 * Get specific hook details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const stmt = req.app.locals.db.prepare(`
      SELECT 
        h.*,
        COUNT(l.id) as execution_count,
        AVG(l.execution_time) as avg_duration,
        MAX(l.created_at) as last_execution,
        SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) as success_count
      FROM hooks h
      LEFT JOIN hook_logs l ON h.id = l.hook_id AND l.event_type = 'execution'
      WHERE h.id = ?
      GROUP BY h.id
    `);
    
    const hook = stmt.get(id);

    if (!hook) {
      return res.status(404).json({ error: 'Hook not found' });
    }

    // Get recent execution logs
    const logsStmt = req.app.locals.db.prepare(`
      SELECT * FROM hook_logs 
      WHERE hook_id = ? AND event_type = 'execution'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const recentLogs = logsStmt.all(id);

    res.json({
      ...hook,
      status: hook.enabled ? 'active' : 'disabled',
      recentLogs: recentLogs.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : {}
      }))
    });

  } catch (error) {
    console.error('Error getting hook:', error);
    res.status(500).json({ 
      error: 'Failed to get hook',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/hooks
 * Create new hook
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      event,
      condition = 'always',
      conditionParams = {},
      command,
      timeout = 30000,
      enabled = true,
      project_path
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!name || !event || !command) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'event', 'command']
      });
    }

    // Validate event type
    const validEvents = [
      'PreToolUse', 'PostToolUse', 'PreChatMessage', 'PostChatMessage',
      'FileChange', 'GitCommit', 'ProjectLoad', 'SessionStart', 
      'SessionEnd', 'Error'
    ];

    if (!validEvents.includes(event)) {
      return res.status(400).json({ 
        error: 'Invalid event type',
        validEvents
      });
    }

    // Generate hook ID
    const hookId = crypto.randomUUID();

    // Store hook configuration
    const hookConfig = {
      name,
      description,
      event,
      condition,
      conditionParams,
      command,
      timeout: Math.min(Math.max(timeout, 1000), 300000), // 1s to 5min
      enabled: enabled ? 1 : 0,
      project_path
    };

    // Save to database
    const stmt = req.app.locals.db.prepare(`
      INSERT INTO hooks (
        id, name, description, event, condition, condition_params,
        command, timeout, enabled, project_path, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      hookId,
      hookConfig.name,
      hookConfig.description,
      hookConfig.event,
      hookConfig.condition,
      JSON.stringify(hookConfig.conditionParams),
      hookConfig.command,
      hookConfig.timeout,
      hookConfig.enabled,
      hookConfig.project_path,
      userId
    );

    // Save hook file to filesystem
    if (hookConfig.enabled) {
      await hookProcessor.registerHook(hookId, hookConfig);
    }

    // Log creation
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO hook_logs (hook_id, event_type, status, metadata)
      VALUES (?, 'creation', 'success', ?)
    `);
    
    logStmt.run(hookId, JSON.stringify({
      createdBy: userId,
      event: hookConfig.event,
      enabled: hookConfig.enabled
    }));

    res.status(201).json({
      id: hookId,
      name: hookConfig.name,
      event: hookConfig.event,
      enabled: hookConfig.enabled,
      message: 'Hook created successfully'
    });

  } catch (error) {
    console.error('Error creating hook:', error);
    res.status(400).json({ 
      error: 'Failed to create hook',
      details: error.message 
    });
  }
});

/**
 * PUT /api/v1/hooks/:id
 * Update hook configuration
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      condition,
      conditionParams,
      command,
      timeout,
      enabled
    } = req.body;

    const userId = req.user.id;

    // Check if hook exists
    const existingStmt = req.app.locals.db.prepare('SELECT * FROM hooks WHERE id = ?');
    const existing = existingStmt.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Hook not found' });
    }

    // Build update query
    const updates = {};
    const params = [];

    if (name !== undefined) {
      updates.name = '?';
      params.push(name);
    }
    if (description !== undefined) {
      updates.description = '?';
      params.push(description);
    }
    if (condition !== undefined) {
      updates.condition = '?';
      params.push(condition);
    }
    if (conditionParams !== undefined) {
      updates.condition_params = '?';
      params.push(JSON.stringify(conditionParams));
    }
    if (command !== undefined) {
      updates.command = '?';
      params.push(command);
    }
    if (timeout !== undefined) {
      updates.timeout = '?';
      params.push(Math.min(Math.max(timeout, 1000), 300000));
    }
    if (enabled !== undefined) {
      updates.enabled = '?';
      params.push(enabled ? 1 : 0);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    // Update hook
    updates.updated_at = "datetime('now')";
    const updateQuery = `
      UPDATE hooks 
      SET ${Object.entries(updates).map(([key, value]) => `${key} = ${value}`).join(', ')}
      WHERE id = ?
    `;
    
    params.push(id);
    const updateStmt = req.app.locals.db.prepare(updateQuery);
    updateStmt.run(...params);

    // Update hook processor registration
    const updatedHook = req.app.locals.db.prepare('SELECT * FROM hooks WHERE id = ?').get(id);
    
    if (updatedHook.enabled) {
      await hookProcessor.registerHook(id, {
        ...updatedHook,
        conditionParams: updatedHook.condition_params ? JSON.parse(updatedHook.condition_params) : {}
      });
    } else {
      await hookProcessor.unregisterHook(id);
    }

    // Log update
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO hook_logs (hook_id, event_type, status, metadata)
      VALUES (?, 'update', 'success', ?)
    `);
    
    logStmt.run(id, JSON.stringify({
      updatedBy: userId,
      updates: Object.keys(updates).filter(key => key !== 'updated_at')
    }));

    res.json({ message: 'Hook updated successfully' });

  } catch (error) {
    console.error('Error updating hook:', error);
    res.status(400).json({ 
      error: 'Failed to update hook',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/v1/hooks/:id
 * Delete hook
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if hook exists
    const existingStmt = req.app.locals.db.prepare('SELECT * FROM hooks WHERE id = ?');
    const existing = existingStmt.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Hook not found' });
    }

    // Unregister from processor
    await hookProcessor.unregisterHook(id);

    // Delete from database (cascading deletes will handle logs)
    const deleteStmt = req.app.locals.db.prepare('DELETE FROM hooks WHERE id = ?');
    deleteStmt.run(id);

    // Log deletion
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO hook_logs (hook_id, event_type, status, metadata)
      VALUES (?, 'deletion', 'success', ?)
    `);
    
    logStmt.run(id, JSON.stringify({
      deletedBy: userId,
      hookName: existing.name
    }));

    res.json({ 
      message: 'Hook deleted successfully',
      id,
      name: existing.name
    });

  } catch (error) {
    console.error('Error deleting hook:', error);
    res.status(500).json({ 
      error: 'Failed to delete hook',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/hooks/:id/test
 * Test hook execution
 */
router.post('/:id/test', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { mockData = {} } = req.body;

    // Get hook configuration
    const stmt = req.app.locals.db.prepare('SELECT * FROM hooks WHERE id = ?');
    const hook = stmt.get(id);

    if (!hook) {
      return res.status(404).json({ error: 'Hook not found' });
    }

    // Execute hook test
    const testResult = await hookProcessor.testHook(id, {
      event: hook.event,
      data: mockData,
      projectPath: hook.project_path
    });

    // Log test execution
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO hook_logs (hook_id, event_type, status, execution_time, metadata)
      VALUES (?, 'test', ?, ?, ?)
    `);
    
    logStmt.run(
      id,
      testResult.success ? 'success' : 'error',
      testResult.executionTime,
      JSON.stringify({
        testMode: true,
        mockData,
        output: testResult.output?.substring(0, 1000), // Store first 1000 chars
        error: testResult.error
      })
    );

    res.json({
      success: testResult.success,
      executionTime: testResult.executionTime,
      output: testResult.output,
      error: testResult.error,
      message: testResult.success ? 'Hook test passed' : 'Hook test failed'
    });

  } catch (error) {
    console.error('Error testing hook:', error);
    res.status(500).json({ 
      error: 'Failed to test hook',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/hooks/:id/logs
 * Get hook execution logs
 */
router.get('/:id/logs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, event_type } = req.query;

    let query = `
      SELECT * FROM hook_logs 
      WHERE hook_id = ?
    `;
    const params = [id];

    if (event_type) {
      query += ' AND event_type = ?';
      params.push(event_type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const stmt = req.app.locals.db.prepare(query);
    const logs = stmt.all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM hook_logs WHERE hook_id = ?';
    const countParams = [id];
    
    if (event_type) {
      countQuery += ' AND event_type = ?';
      countParams.push(event_type);
    }

    const countStmt = req.app.locals.db.prepare(countQuery);
    const { total } = countStmt.get(...countParams);

    res.json({
      logs: logs.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : {}
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });

  } catch (error) {
    console.error('Error fetching hook logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch hook logs',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/hooks/events
 * Get available hook events
 */
router.get('/meta/events', authenticateToken, async (req, res) => {
  try {
    const events = hookProcessor.getAvailableEvents();
    
    res.json({
      events,
      count: Object.keys(events).length
    });

  } catch (error) {
    console.error('Error fetching hook events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch hook events',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/hooks/templates
 * Get hook templates
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { category, search } = req.query;
    
    let templates;
    
    if (search) {
      templates = templateLibrary.searchTemplates(search);
    } else if (category) {
      templates = templateLibrary.getTemplatesByCategory(category);
    } else {
      templates = templateLibrary.getAllTemplates();
    }
    
    res.json({
      templates,
      categories: templateLibrary.getTemplateCategories(),
      count: templates.length
    });

  } catch (error) {
    console.error('Error fetching hook templates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch hook templates',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/hooks/trigger
 * Manually trigger hooks for an event (internal use)
 */
router.post('/trigger', authenticateToken, async (req, res) => {
  try {
    const { event, data, projectPath } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    const results = await hookProcessor.processEvent(event, data, projectPath);

    res.json({
      event,
      processedHooks: results.length,
      results: results.map(result => ({
        hookId: result.hookId,
        hookName: result.hookName,
        success: result.success,
        executionTime: result.executionTime,
        error: result.error
      }))
    });

  } catch (error) {
    console.error('Error triggering hooks:', error);
    res.status(500).json({ 
      error: 'Failed to trigger hooks',
      details: error.message 
    });
  }
});

export default router;