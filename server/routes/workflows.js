import express from 'express';
import crypto from 'crypto';
import WorkflowProcessor from '../extensions/workflows/processor.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Initialize workflow processor
let workflowProcessor;

// Initialize middleware
router.use((req, res, next) => {
  if (!workflowProcessor) {
    workflowProcessor = new WorkflowProcessor(req.app.locals.db);
  }
  next();
});

/**
 * GET /api/v1/workflows
 * List all workflows
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      enabled, 
      project_path,
      search,
      limit = 50,
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        w.*,
        COUNT(l.id) as execution_count,
        MAX(l.created_at) as last_execution,
        AVG(l.execution_time) as avg_duration,
        SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) as success_count
      FROM workflows w
      LEFT JOIN workflow_logs l ON w.id = l.workflow_id AND l.event_type = 'execution'
      WHERE 1=1
    `;
    
    const params = [];

    if (enabled !== undefined) {
      query += ' AND w.enabled = ?';
      params.push(enabled === 'true' ? 1 : 0);
    }

    if (project_path) {
      query += ' AND (w.project_path = ? OR w.project_path IS NULL)';
      params.push(project_path);
    }

    if (search) {
      query += ' AND (w.name LIKE ? OR w.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += `
      GROUP BY w.id
      ORDER BY w.enabled DESC, w.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), parseInt(offset));

    const stmt = req.app.locals.db.prepare(query);
    const workflows = stmt.all(...params);

    // Parse JSON fields
    const processedWorkflows = workflows.map(workflow => ({
      ...workflow,
      trigger: workflow.trigger ? JSON.parse(workflow.trigger) : {},
      steps: workflow.steps ? JSON.parse(workflow.steps) : [],
      settings: workflow.settings ? JSON.parse(workflow.settings) : {}
    }));

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM workflows w WHERE 1=1`;
    const countParams = [];

    if (enabled !== undefined) {
      countQuery += ' AND w.enabled = ?';
      countParams.push(enabled === 'true' ? 1 : 0);
    }
    if (project_path) {
      countQuery += ' AND (w.project_path = ? OR w.project_path IS NULL)';
      countParams.push(project_path);
    }
    if (search) {
      countQuery += ' AND (w.name LIKE ? OR w.description LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countStmt = req.app.locals.db.prepare(countQuery);
    const { total } = countStmt.get(...countParams);

    res.json({
      workflows: processedWorkflows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });

  } catch (error) {
    console.error('Error listing workflows:', error);
    res.status(500).json({ 
      error: 'Failed to list workflows',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/workflows/:id
 * Get specific workflow details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const stmt = req.app.locals.db.prepare(`
      SELECT 
        w.*,
        COUNT(l.id) as execution_count,
        MAX(l.created_at) as last_execution,
        AVG(l.execution_time) as avg_duration,
        SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) as success_count
      FROM workflows w
      LEFT JOIN workflow_logs l ON w.id = l.workflow_id AND l.event_type = 'execution'
      WHERE w.id = ?
      GROUP BY w.id
    `);
    
    const workflow = stmt.get(id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Parse JSON fields
    const processedWorkflow = {
      ...workflow,
      trigger: workflow.trigger ? JSON.parse(workflow.trigger) : {},
      steps: workflow.steps ? JSON.parse(workflow.steps) : [],
      settings: workflow.settings ? JSON.parse(workflow.settings) : {}
    };

    // Get recent execution logs
    const logsStmt = req.app.locals.db.prepare(`
      SELECT * FROM workflow_logs 
      WHERE workflow_id = ? AND event_type = 'execution'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const recentLogs = logsStmt.all(id);

    res.json({
      ...processedWorkflow,
      recentLogs: recentLogs.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : {}
      }))
    });

  } catch (error) {
    console.error('Error getting workflow:', error);
    res.status(500).json({ 
      error: 'Failed to get workflow',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/workflows
 * Create new workflow
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      trigger,
      steps,
      settings = {},
      enabled = true,
      project_path
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!name || !trigger || !steps || steps.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['name', 'trigger', 'steps']
      });
    }

    // Generate workflow ID
    const workflowId = crypto.randomUUID();

    // Save to database
    const stmt = req.app.locals.db.prepare(`
      INSERT INTO workflows (
        id, name, description, trigger, steps, settings,
        enabled, project_path, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      workflowId,
      name,
      description,
      JSON.stringify(trigger),
      JSON.stringify(steps),
      JSON.stringify(settings),
      enabled ? 1 : 0,
      project_path,
      userId
    );

    // Register with processor if enabled
    if (enabled) {
      await workflowProcessor.registerWorkflow(workflowId, {
        name,
        description,
        trigger,
        steps,
        settings,
        enabled,
        project_path
      });
    }

    // Log creation
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO workflow_logs (workflow_id, event_type, status, metadata)
      VALUES (?, 'creation', 'success', ?)
    `);
    
    logStmt.run(workflowId, JSON.stringify({
      createdBy: userId,
      stepCount: steps.length,
      trigger: trigger.event
    }));

    res.status(201).json({
      id: workflowId,
      name,
      message: 'Workflow created successfully'
    });

  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(400).json({ 
      error: 'Failed to create workflow',
      details: error.message 
    });
  }
});

/**
 * PUT /api/v1/workflows/:id
 * Update workflow
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      trigger,
      steps,
      settings,
      enabled
    } = req.body;

    const userId = req.user.id;

    // Check if workflow exists
    const existingStmt = req.app.locals.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const existing = existingStmt.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
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
    if (trigger !== undefined) {
      updates.trigger = '?';
      params.push(JSON.stringify(trigger));
    }
    if (steps !== undefined) {
      updates.steps = '?';
      params.push(JSON.stringify(steps));
    }
    if (settings !== undefined) {
      updates.settings = '?';
      params.push(JSON.stringify(settings));
    }
    if (enabled !== undefined) {
      updates.enabled = '?';
      params.push(enabled ? 1 : 0);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    // Update workflow
    updates.updated_at = "datetime('now')";
    const updateQuery = `
      UPDATE workflows 
      SET ${Object.entries(updates).map(([key, value]) => `${key} = ${value}`).join(', ')}
      WHERE id = ?
    `;
    
    params.push(id);
    const updateStmt = req.app.locals.db.prepare(updateQuery);
    updateStmt.run(...params);

    // Update processor registration
    const updatedWorkflow = req.app.locals.db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    
    if (updatedWorkflow.enabled) {
      await workflowProcessor.registerWorkflow(id, {
        ...updatedWorkflow,
        trigger: JSON.parse(updatedWorkflow.trigger),
        steps: JSON.parse(updatedWorkflow.steps),
        settings: JSON.parse(updatedWorkflow.settings)
      });
    } else {
      await workflowProcessor.unregisterWorkflow(id);
    }

    // Log update
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO workflow_logs (workflow_id, event_type, status, metadata)
      VALUES (?, 'update', 'success', ?)
    `);
    
    logStmt.run(id, JSON.stringify({
      updatedBy: userId,
      updates: Object.keys(updates).filter(key => key !== 'updated_at')
    }));

    res.json({ message: 'Workflow updated successfully' });

  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(400).json({ 
      error: 'Failed to update workflow',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/v1/workflows/:id
 * Delete workflow
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if workflow exists
    const existingStmt = req.app.locals.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const existing = existingStmt.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Unregister from processor
    await workflowProcessor.unregisterWorkflow(id);

    // Delete from database
    const deleteStmt = req.app.locals.db.prepare('DELETE FROM workflows WHERE id = ?');
    deleteStmt.run(id);

    // Log deletion
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO workflow_logs (workflow_id, event_type, status, metadata)
      VALUES (?, 'deletion', 'success', ?)
    `);
    
    logStmt.run(id, JSON.stringify({
      deletedBy: userId,
      workflowName: existing.name
    }));

    res.json({ 
      message: 'Workflow deleted successfully',
      id,
      name: existing.name
    });

  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ 
      error: 'Failed to delete workflow',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/workflows/:id/test
 * Test workflow execution
 */
router.post('/:id/test', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { mockData = {} } = req.body;

    // Get workflow configuration
    const stmt = req.app.locals.db.prepare('SELECT * FROM workflows WHERE id = ?');
    const workflow = stmt.get(id);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Parse workflow data
    const workflowData = {
      ...workflow,
      trigger: JSON.parse(workflow.trigger),
      steps: JSON.parse(workflow.steps),
      settings: JSON.parse(workflow.settings)
    };

    // Execute workflow test
    const testResult = await workflowProcessor.testWorkflow(id, {
      trigger: workflowData.trigger,
      data: mockData,
      projectPath: workflow.project_path
    });

    // Log test execution
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO workflow_logs (workflow_id, event_type, status, execution_time, metadata)
      VALUES (?, 'test', ?, ?, ?)
    `);
    
    logStmt.run(
      id,
      testResult.success ? 'success' : 'error',
      testResult.executionTime,
      JSON.stringify({
        testMode: true,
        mockData,
        stepResults: testResult.stepResults,
        error: testResult.error
      })
    );

    res.json({
      success: testResult.success,
      executionTime: testResult.executionTime,
      stepResults: testResult.stepResults,
      error: testResult.error,
      message: testResult.success ? 'Workflow test passed' : 'Workflow test failed'
    });

  } catch (error) {
    console.error('Error testing workflow:', error);
    res.status(500).json({ 
      error: 'Failed to test workflow',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/workflows/test
 * Test workflow configuration (without saving)
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { trigger, steps, settings, mockData = {} } = req.body;

    if (!trigger || !steps || steps.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['trigger', 'steps']
      });
    }

    // Create temporary workflow for testing
    const tempWorkflow = {
      id: 'test-' + Date.now(),
      name: 'Test Workflow',
      trigger,
      steps,
      settings: settings || {}
    };

    const testResult = await workflowProcessor.testWorkflow(tempWorkflow.id, {
      trigger,
      data: mockData
    }, tempWorkflow);

    res.json({
      success: testResult.success,
      executionTime: testResult.executionTime,
      stepResults: testResult.stepResults,
      error: testResult.error,
      message: testResult.success ? 'Workflow test passed' : 'Workflow test failed'
    });

  } catch (error) {
    console.error('Error testing workflow configuration:', error);
    res.status(500).json({ 
      error: 'Failed to test workflow configuration',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/workflows/:id/logs
 * Get workflow execution logs
 */
router.get('/:id/logs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, event_type } = req.query;

    let query = `
      SELECT * FROM workflow_logs 
      WHERE workflow_id = ?
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
    let countQuery = 'SELECT COUNT(*) as total FROM workflow_logs WHERE workflow_id = ?';
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
    console.error('Error fetching workflow logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch workflow logs',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/workflows/trigger
 * Manually trigger workflows for an event
 */
router.post('/trigger', authenticateToken, async (req, res) => {
  try {
    const { event, data, projectPath } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    const results = await workflowProcessor.processEvent(event, data, projectPath);

    res.json({
      event,
      processedWorkflows: results.length,
      results: results.map(result => ({
        workflowId: result.workflowId,
        workflowName: result.workflowName,
        success: result.success,
        executionTime: result.executionTime,
        stepResults: result.stepResults,
        error: result.error
      }))
    });

  } catch (error) {
    console.error('Error triggering workflows:', error);
    res.status(500).json({ 
      error: 'Failed to trigger workflows',
      details: error.message 
    });
  }
});

export default router;