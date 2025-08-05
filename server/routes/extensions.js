import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import ExtensionManager from '../extensions/manager.js';
import ExtensionClassifier from '../extensions/classifier.js';
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

// Initialize middleware
router.use((req, res, next) => {
  if (!extensionManager) {
    extensionManager = new ExtensionManager();
  }
  if (!extensionClassifier) {
    extensionClassifier = new ExtensionClassifier(extensionManager, req.app.locals.db);
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

    // Handle file upload if present
    let filePath = null;
    if (req.file) {
      const fileName = `${extensionId}${path.extname(req.file.originalname)}`;
      const destinationPath = path.join(
        extensionManager.getPaths().global[type + 's'] || extensionManager.getPaths().global.extensions,
        fileName
      );
      
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.rename(req.file.path, destinationPath);
      filePath = destinationPath;
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
      name,
      description,
      version,
      validatedClassification,
      type,
      source,
      source_url,
      filePath,
      config,
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
      name,
      classification: validatedClassification,
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

export default router;