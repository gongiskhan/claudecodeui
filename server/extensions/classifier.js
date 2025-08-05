import { promises as fs } from 'fs';
import path from 'path';

/**
 * Three-Tier Classification System for Extensions
 * Manages Selectable, Default, and User classifications
 */
class ExtensionClassifier {
  constructor(extensionManager, database) {
    this.extensionManager = extensionManager;
    this.db = database;
  }

  /**
   * Classification definitions and behaviors
   */
  static CLASSIFICATIONS = {
    SELECTABLE: 'selectable',
    DEFAULT: 'default', 
    USER: 'user'
  };

  static CLASSIFICATION_RULES = {
    [this.CLASSIFICATIONS.SELECTABLE]: {
      scope: 'project',
      requiresSelection: true,
      autoEnable: false,
      removable: true,
      inheritGlobal: false,
      description: 'Extensions that must be manually selected per project'
    },
    [this.CLASSIFICATIONS.DEFAULT]: {
      scope: 'project',
      requiresSelection: false,
      autoEnable: true,
      removable: true,
      inheritGlobal: true,
      description: 'Extensions automatically included in new projects (but removable)'
    },
    [this.CLASSIFICATIONS.USER]: {
      scope: 'global',
      requiresSelection: false,
      autoEnable: true,
      removable: false,
      inheritGlobal: true,
      description: 'Extensions added at user scope across all projects'
    }
  };

  /**
   * Classify an extension based on its configuration
   */
  async classifyExtension(extensionConfig, requestedClassification = null) {
    const { type, source, metadata = {} } = extensionConfig;

    // If explicitly requested, validate and use it
    if (requestedClassification && this.isValidClassification(requestedClassification)) {
      return this.validateClassificationForExtension(extensionConfig, requestedClassification);
    }

    // Auto-classify based on extension characteristics
    return this.autoClassifyExtension(extensionConfig);
  }

  /**
   * Auto-classify extension based on its properties
   */
  autoClassifyExtension(extensionConfig) {
    const { type, source, metadata = {} } = extensionConfig;

    // User-specific extensions
    if (source === 'local' || metadata.scope === 'user') {
      return ExtensionClassifier.CLASSIFICATIONS.USER;
    }

    // Community extensions default to selectable
    if (source === 'github' || source === 'npm') {
      return ExtensionClassifier.CLASSIFICATIONS.SELECTABLE;
    }

    // Framework or tool extensions default to default classification
    if (metadata.category === 'framework' || metadata.category === 'tool') {
      return ExtensionClassifier.CLASSIFICATIONS.DEFAULT;
    }

    // Fallback to selectable
    return ExtensionClassifier.CLASSIFICATIONS.SELECTABLE;
  }

  /**
   * Validate if a classification is appropriate for an extension
   */
  validateClassificationForExtension(extensionConfig, classification) {
    const rules = ExtensionClassifier.CLASSIFICATION_RULES[classification];
    
    if (!rules) {
      throw new Error(`Invalid classification: ${classification}`);
    }

    // Check if extension meets classification requirements
    const { type, metadata = {} } = extensionConfig;

    // USER classification restrictions
    if (classification === ExtensionClassifier.CLASSIFICATIONS.USER) {
      if (metadata.requiresProjectContext === true) {
        throw new Error('Extensions requiring project context cannot be USER classified');
      }
    }

    return classification;
  }

  /**
   * Get extensions by classification
   */
  async getExtensionsByClassification(classification, projectPath = null) {
    const stmt = this.db.prepare(`
      SELECT e.*, pe.enabled as project_enabled, pe.config_override
      FROM extensions e
      LEFT JOIN project_extensions pe ON e.id = pe.extension_id AND pe.project_path = ?
      WHERE e.classification = ?
      ORDER BY e.name
    `);

    return stmt.all(projectPath, classification);
  }

  /**
   * Apply classification rules to project
   */
  async applyClassificationToProject(projectPath) {
    const results = {
      applied: [],
      skipped: [],
      errors: []
    };

    // Get all default and user extensions
    const defaultExtensions = await this.getExtensionsByClassification(
      ExtensionClassifier.CLASSIFICATIONS.DEFAULT
    );
    const userExtensions = await this.getExtensionsByClassification(
      ExtensionClassifier.CLASSIFICATIONS.USER
    );

    // Apply default extensions to project
    for (const ext of defaultExtensions) {
      try {
        await this.enableExtensionForProject(ext.id, projectPath, true);
        results.applied.push({ id: ext.id, name: ext.name, classification: 'default' });
      } catch (error) {
        results.errors.push({ id: ext.id, error: error.message });
      }
    }

    // Apply user extensions to project
    for (const ext of userExtensions) {
      try {
        await this.enableExtensionForProject(ext.id, projectPath, true);
        results.applied.push({ id: ext.id, name: ext.name, classification: 'user' });
      } catch (error) {
        results.errors.push({ id: ext.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Enable extension for a specific project
   */
  async enableExtensionForProject(extensionId, projectPath, enabled = true) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO project_extensions 
      (project_path, extension_id, enabled, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    return stmt.run(projectPath, extensionId, enabled ? 1 : 0);
  }

  /**
   * Get project's extension configuration
   */
  async getProjectExtensions(projectPath) {
    const stmt = this.db.prepare(`
      SELECT 
        e.id,
        e.name,
        e.description,
        e.version,
        e.classification,
        e.type,
        e.status,
        pe.enabled,
        pe.config_override,
        pe.updated_at as project_updated_at
      FROM extensions e
      JOIN project_extensions pe ON e.id = pe.extension_id
      WHERE pe.project_path = ?
      ORDER BY e.classification, e.name
    `);

    const extensions = stmt.all(projectPath);

    // Group by classification
    return {
      selectable: extensions.filter(e => e.classification === ExtensionClassifier.CLASSIFICATIONS.SELECTABLE),
      default: extensions.filter(e => e.classification === ExtensionClassifier.CLASSIFICATIONS.DEFAULT),
      user: extensions.filter(e => e.classification === ExtensionClassifier.CLASSIFICATIONS.USER),
      summary: {
        total: extensions.length,
        enabled: extensions.filter(e => e.enabled).length,
        byClassification: {
          [ExtensionClassifier.CLASSIFICATIONS.SELECTABLE]: extensions.filter(e => 
            e.classification === ExtensionClassifier.CLASSIFICATIONS.SELECTABLE
          ).length,
          [ExtensionClassifier.CLASSIFICATIONS.DEFAULT]: extensions.filter(e => 
            e.classification === ExtensionClassifier.CLASSIFICATIONS.DEFAULT
          ).length,
          [ExtensionClassifier.CLASSIFICATIONS.USER]: extensions.filter(e => 
            e.classification === ExtensionClassifier.CLASSIFICATIONS.USER
          ).length
        }
      }
    };
  }

  /**
   * Change extension classification
   */
  async reclassifyExtension(extensionId, newClassification, userId) {
    // Validate new classification
    if (!this.isValidClassification(newClassification)) {
      throw new Error(`Invalid classification: ${newClassification}`);
    }

    // Get current extension
    const extension = await this.getExtension(extensionId);
    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    // Validate the reclassification
    this.validateClassificationForExtension(extension, newClassification);

    // Update extension classification
    const stmt = this.db.prepare(`
      UPDATE extensions 
      SET classification = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(newClassification, extensionId);

    // If reclassifying to/from user scope, update project associations
    if (newClassification === ExtensionClassifier.CLASSIFICATIONS.USER ||
        extension.classification === ExtensionClassifier.CLASSIFICATIONS.USER) {
      await this.updateProjectAssociationsForReclassification(extensionId, newClassification);
    }

    return result;
  }

  /**
   * Update project associations when extension is reclassified
   */
  async updateProjectAssociationsForReclassification(extensionId, newClassification) {
    if (newClassification === ExtensionClassifier.CLASSIFICATIONS.USER) {
      // If becoming user extension, enable for all projects
      const projects = await this.getAllProjects();
      for (const project of projects) {
        await this.enableExtensionForProject(extensionId, project.path, true);
      }
    }
    // Note: When moving away from user classification, 
    // we don't automatically disable to avoid disrupting existing configurations
  }

  /**
   * Helper methods
   */
  isValidClassification(classification) {
    return Object.values(ExtensionClassifier.CLASSIFICATIONS).includes(classification);
  }

  async getExtension(extensionId) {
    const stmt = this.db.prepare('SELECT * FROM extensions WHERE id = ?');
    return stmt.get(extensionId);
  }

  async getAllProjects() {
    // This would be implemented to return all known projects
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Get classification rules and metadata
   */
  getClassificationInfo() {
    return {
      classifications: ExtensionClassifier.CLASSIFICATIONS,
      rules: ExtensionClassifier.CLASSIFICATION_RULES,
      hierarchy: [
        ExtensionClassifier.CLASSIFICATIONS.USER,
        ExtensionClassifier.CLASSIFICATIONS.DEFAULT,
        ExtensionClassifier.CLASSIFICATIONS.SELECTABLE
      ]
    };
  }
}

export default ExtensionClassifier;