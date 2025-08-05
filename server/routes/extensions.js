import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import ExtensionManager from '../extensions/manager.js';
import ExtensionClassifier from '../extensions/classifier.js';
import GitHubSourceHandler from '../extensions/sources/github.js';
import { getAllTemplates, getTemplatesByCategory, getTemplateCategories, searchTemplates } from '../extensions/templates/commands.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for extension uploads
const upload = multer({
  dest: 'temp/extensions/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow various extension formats
    const allowedTypes = ['.md', '.json', '.txt', '.yaml', '.yml', '.js', '.ts'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for extension'));
    }
  }
});

// Initialize extension system components
let extensionManager;
let extensionClassifier;
let githubHandler;

// Initialize middleware
router.use((req, res, next) => {
  if (!extensionManager) {
    extensionManager = new ExtensionManager();
  }
  if (!extensionClassifier) {
    extensionClassifier = new ExtensionClassifier(extensionManager, req.app.locals.db);
  }
  if (!githubHandler) {
    githubHandler = new GitHubSourceHandler();
  }
  next();
});

/**
 * GET /api/v1/extensions
 * List all extensions with optional filtering
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      classification, 
      type, 
      status, 
      project_path,
      search,
      limit = 50,
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        e.*,
        pe.enabled as project_enabled,
        pe.config_override,
        pe.updated_at as project_updated_at
      FROM extensions e
      LEFT JOIN project_extensions pe ON e.id = pe.extension_id 
        ${project_path ? 'AND pe.project_path = ?' : ''}
      WHERE 1=1
    `;
    
    const params = [];
    if (project_path) params.push(project_path);

    if (classification) {
      query += ' AND e.classification = ?';
      params.push(classification);
    }

    if (type) {
      query += ' AND e.type = ?';
      params.push(type);
    }

    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (e.name LIKE ? OR e.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY e.classification, e.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const stmt = req.app.locals.db.prepare(query);
    const extensions = stmt.all(...params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM extensions e 
      WHERE 1=1
    `;
    const countParams = [];

    if (classification) {
      countQuery += ' AND e.classification = ?';
      countParams.push(classification);
    }
    if (type) {
      countQuery += ' AND e.type = ?';
      countParams.push(type);
    }
    if (status) {
      countQuery += ' AND e.status = ?';
      countParams.push(status);
    }
    if (search) {
      countQuery += ' AND (e.name LIKE ? OR e.description LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countStmt = req.app.locals.db.prepare(countQuery);
    const { total } = countStmt.get(...countParams);

    res.json({
      extensions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      },
      filters: {
        classification,
        type,
        status,
        project_path,
        search
      }
    });

  } catch (error) {
    console.error('Error listing extensions:', error);
    res.status(500).json({ 
      error: 'Failed to list extensions',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/extensions/:id
 * Get specific extension details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { project_path } = req.query;

    let query = `
      SELECT 
        e.*,
        pe.enabled as project_enabled,
        pe.config_override,
        pe.updated_at as project_updated_at
      FROM extensions e
      LEFT JOIN project_extensions pe ON e.id = pe.extension_id 
        ${project_path ? 'AND pe.project_path = ?' : ''}
      WHERE e.id = ?
    `;

    const params = project_path ? [project_path, id] : [id];
    const stmt = req.app.locals.db.prepare(query);
    const extension = stmt.get(...params);

    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }

    // Get dependencies
    const depsStmt = req.app.locals.db.prepare(`
      SELECT * FROM extension_dependencies 
      WHERE extension_id = ?
    `);
    const dependencies = depsStmt.all(id);

    // Get recent logs
    const logsStmt = req.app.locals.db.prepare(`
      SELECT * FROM extension_logs 
      WHERE extension_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const logs = logsStmt.all(id);

    res.json({
      ...extension,
      dependencies,
      recentLogs: logs
    });

  } catch (error) {
    console.error('Error getting extension:', error);
    res.status(500).json({ 
      error: 'Failed to get extension',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/extensions
 * Install new extension
 */
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const {
      name,
      description,
      version,
      type,
      classification,
      source = 'local',
      source_url,
      config = '{}'
    } = req.body;

    const userId = req.user.id;

    // Generate extension ID
    const extensionId = crypto.randomUUID();

    // Validate classification
    const validatedClassification = await extensionClassifier.classifyExtension({
      type,
      source,
      metadata: JSON.parse(config)
    }, classification);

    // Handle different installation sources
    let filePath = null;
    let actualConfig = config;
    let actualName = name;
    let actualDescription = description;
    
    if (source === 'github' && source_url) {
      // GitHub installation
      try {
        const targetDir = extensionManager.getPaths().global[type + 's'] || extensionManager.getPaths().global.extensions;
        
        const githubResult = await githubHandler.installFromGitHub(source_url, {
          name,
          description,
          classification: validatedClassification,
          version,
          author,
          targetDirectory: targetDir
        });
        
        // Use GitHub installation results
        filePath = githubResult.file_path;
        actualName = githubResult.name;
        actualDescription = githubResult.description;
        actualConfig = githubResult.config;
        
      } catch (error) {
        throw new Error(`GitHub installation failed: ${error.message}`);
      }
    } else if (req.file) {
      // File upload installation
      const fileName = `${extensionId}${path.extname(req.file.originalname)}`;
      const destinationPath = path.join(
        extensionManager.getPaths().global[type + 's'] || extensionManager.getPaths().global.extensions,
        fileName
      );
      
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.rename(req.file.path, destinationPath);
      filePath = destinationPath;
    } else {
      throw new Error('No installation source provided (file or GitHub URL required)');
    }

    // Insert extension into database
    const stmt = req.app.locals.db.prepare(`
      INSERT INTO extensions (
        id, name, description, version, classification, type,
        source, source_url, file_path, config, status, installed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'installed', ?)
    `);

    const result = stmt.run(
      extensionId,
      actualName,
      actualDescription,
      version,
      validatedClassification,
      type,
      source,
      source_url,
      filePath,
      actualConfig,
      userId
    );

    // Apply classification rules (auto-enable for appropriate classifications)
    if (validatedClassification === ExtensionClassifier.CLASSIFICATIONS.DEFAULT ||
        validatedClassification === ExtensionClassifier.CLASSIFICATIONS.USER) {
      // This would be implemented to auto-enable for existing projects
      console.log(`Auto-enabling ${validatedClassification} extension: ${extensionId}`);
    }

    // Log installation
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO extension_logs (extension_id, event_type, status, metadata)
      VALUES (?, 'installation', 'success', ?)
    `);
    
    logStmt.run(extensionId, JSON.stringify({
      installedBy: userId,
      classification: validatedClassification,
      source
    }));

    res.status(201).json({
      id: extensionId,
      name: actualName,
      classification: validatedClassification,
      source: source,
      message: 'Extension installed successfully'
    });

  } catch (error) {
    console.error('Error installing extension:', error);
    
    // Cleanup uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
    }

    res.status(400).json({ 
      error: 'Failed to install extension',
      details: error.message 
    });
  }
});

/**
 * PUT /api/v1/extensions/:id
 * Update extension configuration or status
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      version,
      classification,
      status,
      config,
      project_path,
      enabled
    } = req.body;

    const userId = req.user.id;

    // Check if extension exists
    const existingStmt = req.app.locals.db.prepare('SELECT * FROM extensions WHERE id = ?');
    const existing = existingStmt.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Extension not found' });
    }

    // Handle project-specific updates
    if (project_path !== undefined && enabled !== undefined) {
      const projectStmt = req.app.locals.db.prepare(`
        INSERT OR REPLACE INTO project_extensions 
        (project_path, extension_id, enabled, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `);
      
      projectStmt.run(project_path, id, enabled ? 1 : 0);
      
      return res.json({ 
        message: `Extension ${enabled ? 'enabled' : 'disabled'} for project`,
        project_path,
        enabled
      });
    }

    // Handle global extension updates
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
    if (version !== undefined) {
      updates.version = '?';
      params.push(version);
    }
    if (status !== undefined) {
      updates.status = '?';
      params.push(status);
    }
    if (config !== undefined) {
      updates.config = '?';
      params.push(JSON.stringify(config));
    }

    // Handle classification change
    if (classification !== undefined && classification !== existing.classification) {
      await extensionClassifier.reclassifyExtension(id, classification, userId);
      updates.classification = '?';
      params.push(classification);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    // Update extension
    updates.updated_at = "datetime('now')";
    const updateQuery = `
      UPDATE extensions 
      SET ${Object.entries(updates).map(([key, value]) => `${key} = ${value}`).join(', ')}
      WHERE id = ?
    `;
    
    params.push(id);
    const updateStmt = req.app.locals.db.prepare(updateQuery);
    updateStmt.run(...params);

    // Log update
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO extension_logs (extension_id, event_type, status, metadata)
      VALUES (?, 'update', 'success', ?)
    `);
    
    logStmt.run(id, JSON.stringify({
      updatedBy: userId,
      updates: Object.keys(updates)
    }));

    res.json({ message: 'Extension updated successfully' });

  } catch (error) {
    console.error('Error updating extension:', error);
    res.status(400).json({ 
      error: 'Failed to update extension',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/v1/extensions/:id
 * Uninstall extension
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query;
    const userId = req.user.id;

    // Check if extension exists
    const existingStmt = req.app.locals.db.prepare('SELECT * FROM extensions WHERE id = ?');
    const existing = existingStmt.get(id);

    if (!existing) {
      return res.status(404).json({ error: 'Extension not found' });
    }

    // Check if extension can be removed
    const rules = ExtensionClassifier.CLASSIFICATION_RULES[existing.classification];
    if (!rules.removable && !force) {
      return res.status(400).json({ 
        error: 'Extension cannot be removed',
        reason: `${existing.classification} extensions are not removable`,
        hint: 'Use force=true to override'
      });
    }

    // Check for dependencies
    const dependentsStmt = req.app.locals.db.prepare(`
      SELECT e.id, e.name FROM extensions e
      JOIN extension_dependencies ed ON e.id = ed.extension_id
      WHERE ed.dependency_id = ? AND ed.required = 1
    `);
    const dependents = dependentsStmt.all(id);

    if (dependents.length > 0 && !force) {
      return res.status(400).json({
        error: 'Extension has required dependencies',
        dependents: dependents.map(d => ({ id: d.id, name: d.name })),
        hint: 'Remove dependent extensions first or use force=true'
      });
    }

    // Remove extension file if it exists
    if (existing.file_path) {
      try {
        await fs.unlink(existing.file_path);
      } catch (fileError) {
        console.warn('Could not remove extension file:', fileError.message);
      }
    }

    // Remove from database (cascading deletes will handle related records)
    const deleteStmt = req.app.locals.db.prepare('DELETE FROM extensions WHERE id = ?');
    deleteStmt.run(id);

    // Log removal
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO extension_logs (extension_id, event_type, status, metadata)
      VALUES (?, 'uninstall', 'success', ?)
    `);
    
    logStmt.run(id, JSON.stringify({
      removedBy: userId,
      force: force,
      hadDependents: dependents.length > 0
    }));

    res.json({ 
      message: 'Extension uninstalled successfully',
      id,
      name: existing.name
    });

  } catch (error) {
    console.error('Error uninstalling extension:', error);
    res.status(500).json({ 
      error: 'Failed to uninstall extension',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/extensions/classifications
 * Get classification information and rules
 */
router.get('/meta/classifications', authenticateToken, async (req, res) => {
  try {
    const classificationInfo = extensionClassifier.getClassificationInfo();
    
    // Add counts for each classification
    const counts = {};
    for (const classification of Object.values(ExtensionClassifier.CLASSIFICATIONS)) {
      const stmt = req.app.locals.db.prepare(
        'SELECT COUNT(*) as count FROM extensions WHERE classification = ?'
      );
      counts[classification] = stmt.get(classification).count;
    }

    res.json({
      ...classificationInfo,
      counts
    });
  } catch (error) {
    console.error('Error getting classification info:', error);
    res.status(500).json({ 
      error: 'Failed to get classification information',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/extensions/:id/enable
 * Enable extension for project
 */
router.post('/:id/enable', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { project_path } = req.body;

    if (!project_path) {
      return res.status(400).json({ error: 'project_path is required' });
    }

    await extensionClassifier.enableExtensionForProject(id, project_path, true);
    
    res.json({ 
      message: 'Extension enabled for project',
      extension_id: id,
      project_path
    });

  } catch (error) {
    console.error('Error enabling extension:', error);
    res.status(400).json({ 
      error: 'Failed to enable extension',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/extensions/:id/disable
 * Disable extension for project
 */
router.post('/:id/disable', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { project_path } = req.body;

    if (!project_path) {
      return res.status(400).json({ error: 'project_path is required' });
    }

    await extensionClassifier.enableExtensionForProject(id, project_path, false);
    
    res.json({ 
      message: 'Extension disabled for project',
      extension_id: id,
      project_path
    });

  } catch (error) {
    console.error('Error disabling extension:', error);
    res.status(400).json({ 
      error: 'Failed to disable extension',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/extensions/sources/github/search
 * Search GitHub repositories for extensions
 */
router.get('/sources/github/search', authenticateToken, async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const repositories = await githubHandler.searchRepositories(query, parseInt(limit));
    
    res.json({
      repositories,
      query,
      count: repositories.length
    });

  } catch (error) {
    console.error('Error searching GitHub repositories:', error);
    res.status(500).json({ 
      error: 'Failed to search repositories',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/extensions/sources/github/popular
 * Get popular extension repositories
 */
router.get('/sources/github/popular', authenticateToken, async (req, res) => {
  try {
    const repositories = await githubHandler.getPopularRepositories();
    
    res.json({
      repositories,
      count: repositories.length
    });

  } catch (error) {
    console.error('Error fetching popular repositories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch popular repositories',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/extensions/sources/github/discover
 * Discover extensions in a GitHub repository
 */
router.post('/sources/github/discover', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'GitHub URL is required' });
    }

    const { owner, repo, branch } = githubHandler.parseGitHubUrl(url);
    const extensions = await githubHandler.discoverExtensions(owner, repo, branch);
    
    res.json({
      repository: `${owner}/${repo}`,
      branch,
      extensions,
      count: extensions.length
    });

  } catch (error) {
    console.error('Error discovering extensions:', error);
    res.status(400).json({ 
      error: 'Failed to discover extensions',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/extensions/:id/execute
 * Log command execution
 */
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      project_path, 
      parameters = {}, 
      execution_time = 0,
      status = 'success',
      error_message,
      generated_text 
    } = req.body;

    // Check if extension exists
    const extensionStmt = req.app.locals.db.prepare('SELECT * FROM extensions WHERE id = ?');
    const extension = extensionStmt.get(id);

    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }

    // Log the execution
    const logStmt = req.app.locals.db.prepare(`
      INSERT INTO extension_logs (
        extension_id, project_path, event_type, status, 
        execution_time, error_message, metadata
      ) VALUES (?, ?, 'execution', ?, ?, ?, ?)
    `);
    
    logStmt.run(
      id,
      project_path,
      status,
      execution_time,
      error_message,
      JSON.stringify({
        parameters,
        generated_text: generated_text ? generated_text.substring(0, 500) : null, // Store first 500 chars
        timestamp: new Date().toISOString()
      })
    );

    res.json({ 
      message: 'Execution logged successfully',
      extension_id: id
    });

  } catch (error) {
    console.error('Error logging command execution:', error);
    res.status(500).json({ 
      error: 'Failed to log execution',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/extensions/:id/history
 * Get command execution history
 */
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const stmt = req.app.locals.db.prepare(`
      SELECT * FROM extension_logs 
      WHERE extension_id = ? AND event_type = 'execution'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const history = stmt.all(id, parseInt(limit), parseInt(offset));

    // Get total count
    const countStmt = req.app.locals.db.prepare(`
      SELECT COUNT(*) as total FROM extension_logs 
      WHERE extension_id = ? AND event_type = 'execution'
    `);
    const { total } = countStmt.get(id);

    res.json({
      history: history.map(entry => ({
        ...entry,
        metadata: entry.metadata ? JSON.parse(entry.metadata) : {}
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });

  } catch (error) {
    console.error('Error fetching execution history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch execution history',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/extensions/analytics/usage
 * Get usage analytics for extensions
 */
router.get('/analytics/usage', authenticateToken, async (req, res) => {
  try {
    const { project_path, days = 30 } = req.query;
    const dateLimit = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();

    let query = `
      SELECT 
        e.id,
        e.name,
        e.type,
        e.classification,
        COUNT(l.id) as execution_count,
        AVG(l.execution_time) as avg_execution_time,
        MAX(l.created_at) as last_used,
        SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN l.status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM extensions e
      LEFT JOIN extension_logs l ON e.id = l.extension_id 
        AND l.event_type = 'execution' 
        AND l.created_at >= ?
    `;

    const params = [dateLimit];

    if (project_path) {
      query += ' AND l.project_path = ?';
      params.push(project_path);
    }

    query += `
      GROUP BY e.id, e.name, e.type, e.classification
      ORDER BY execution_count DESC
    `;

    const stmt = req.app.locals.db.prepare(query);
    const analytics = stmt.all(...params);

    // Calculate success rates
    const processedAnalytics = analytics.map(item => ({
      ...item,
      success_rate: item.execution_count > 0 ? (item.success_count / item.execution_count) * 100 : 0,
      avg_execution_time: Math.round(item.avg_execution_time || 0)
    }));

    res.json({
      analytics: processedAnalytics,
      period: {
        days: parseInt(days),
        from: dateLimit,
        to: new Date().toISOString()
      },
      summary: {
        total_extensions: processedAnalytics.length,
        total_executions: processedAnalytics.reduce((sum, item) => sum + item.execution_count, 0),
        most_used: processedAnalytics[0]?.name || null
      }
    });

  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch usage analytics',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/extensions/templates
 * Get all command templates
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { category, search } = req.query;
    
    let templates;
    
    if (search) {
      templates = searchTemplates(search);
    } else if (category) {
      templates = getTemplatesByCategory(category);
    } else {
      templates = getAllTemplates();
    }
    
    res.json({
      templates,
      categories: getTemplateCategories(),
      count: templates.length
    });

  } catch (error) {
    console.error('Error fetching command templates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch command templates',
      details: error.message 
    });
  }
});

/**
 * GET /api/v1/extensions/templates/categories
 * Get template categories
 */
router.get('/templates/categories', authenticateToken, async (req, res) => {
  try {
    const categories = getTemplateCategories();
    
    res.json({
      categories,
      count: categories.length
    });

  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch template categories',
      details: error.message 
    });
  }
});

export default router;