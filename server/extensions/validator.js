import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';

/**
 * Extension Validation System
 * Validates different extension formats including Sub-Agents, Commands, and Hooks
 */
class ExtensionValidator {
  
  /**
   * Sub-Agent validation schema
   */
  static AGENT_SCHEMA = {
    required: ['name', 'description'],
    optional: ['classification', 'tools', 'model', 'version', 'author', 'tags', 'dependencies'],
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9-_]+$/
      },
      description: {
        type: 'string',
        minLength: 10,
        maxLength: 500
      },
      classification: {
        type: 'string',
        enum: ['selectable', 'default', 'user']
      },
      tools: {
        type: 'array',
        items: { type: 'string' }
      },
      model: {
        type: 'string',
        enum: ['sonnet', 'haiku', 'opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-opus']
      },
      version: {
        type: 'string',
        pattern: /^\d+\.\d+\.\d+$/
      },
      author: {
        type: 'string',
        maxLength: 100
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 10
      },
      dependencies: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            optional: { type: 'boolean' }
          }
        }
      }
    }
  };

  /**
   * Command validation schema
   */
  static COMMAND_SCHEMA = {
    required: ['name', 'description', 'template'],
    optional: ['classification', 'version', 'author', 'tags', 'parameters'],
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9-_]+$/
      },
      description: {
        type: 'string',
        minLength: 10,
        maxLength: 300
      },
      template: {
        type: 'string',
        minLength: 1
      },
      classification: {
        type: 'string',
        enum: ['selectable', 'default', 'user']
      },
      parameters: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string', pattern: /^[A-Z_]+$/ },
            type: { type: 'string', enum: ['string', 'number', 'boolean', 'file', 'directory'] },
            description: { type: 'string' },
            required: { type: 'boolean', default: true },
            default: { type: 'string' }
          }
        }
      }
    }
  };

  /**
   * Hook validation schema
   */
  static HOOK_SCHEMA = {
    required: ['name', 'event', 'command'],
    optional: ['description', 'condition', 'timeout', 'enabled', 'classification'],
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9-_]+$/
      },
      description: {
        type: 'string',
        maxLength: 200
      },
      event: {
        type: 'string',
        enum: ['PreToolUse', 'PostToolUse', 'Notification', 'Stop']
      },
      condition: {
        type: 'string',
        maxLength: 500
      },
      command: {
        type: 'string',
        minLength: 1
      },
      timeout: {
        type: 'number',
        minimum: 1000,
        maximum: 300000 // 5 minutes max
      },
      enabled: {
        type: 'boolean',
        default: true
      }
    }
  };

  /**
   * Validate Sub-Agent file (YAML frontmatter + Markdown)
   */
  static async validateAgent(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const result = this.parseAgentFile(content);
      
      // Validate frontmatter
      const validation = this.validateSchema(result.frontmatter, this.AGENT_SCHEMA);
      if (!validation.valid) {
        return {
          valid: false,
          errors: validation.errors,
          type: 'agent'
        };
      }

      // Validate markdown content
      if (!result.content || result.content.trim().length < 50) {
        return {
          valid: false,
          errors: ['Agent description content must be at least 50 characters'],
          type: 'agent'
        };
      }

      // Additional semantic validation
      const semanticErrors = this.validateAgentSemantics(result.frontmatter, result.content);
      if (semanticErrors.length > 0) {
        return {
          valid: false,
          errors: semanticErrors,
          type: 'agent'
        };
      }

      return {
        valid: true,
        type: 'agent',
        data: {
          metadata: result.frontmatter,
          content: result.content,
          hash: this.generateHash(content)
        }
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`File parsing error: ${error.message}`],
        type: 'agent'
      };
    }
  }

  /**
   * Parse Sub-Agent file with YAML frontmatter
   */
  static parseAgentFile(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      throw new Error('Invalid agent file format - missing YAML frontmatter');
    }

    const [, yamlContent, markdownContent] = match;
    
    let frontmatter;
    try {
      frontmatter = yaml.load(yamlContent);
    } catch (error) {
      throw new Error(`Invalid YAML frontmatter: ${error.message}`);
    }

    return {
      frontmatter,
      content: markdownContent.trim()
    };
  }

  /**
   * Validate Command file
   */
  static async validateCommand(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const result = this.parseCommandFile(content);
      
      // If it has frontmatter, validate it
      if (result.frontmatter) {
        const validation = this.validateSchema(result.frontmatter, this.COMMAND_SCHEMA);
        if (!validation.valid) {
          return {
            valid: false,
            errors: validation.errors,
            type: 'command'
          };
        }
      }

      // Validate command template
      const templateErrors = this.validateCommandTemplate(result.template);
      if (templateErrors.length > 0) {
        return {
          valid: false,
          errors: templateErrors,
          type: 'command'
        };
      }

      return {
        valid: true,
        type: 'command',
        data: {
          metadata: result.frontmatter || this.extractCommandMetadata(result.template),
          template: result.template,
          parameters: this.extractCommandParameters(result.template),
          hash: this.generateHash(content)
        }
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`File parsing error: ${error.message}`],
        type: 'command'
      };
    }
  }

  /**
   * Parse Command file (plain text or with YAML frontmatter)
   */
  static parseCommandFile(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
      // Has frontmatter
      const [, yamlContent, templateContent] = match;
      let frontmatter;
      
      try {
        frontmatter = yaml.load(yamlContent);
      } catch (error) {
        throw new Error(`Invalid YAML frontmatter: ${error.message}`);
      }

      return {
        frontmatter,
        template: templateContent.trim()
      };
    } else {
      // Plain text command
      return {
        frontmatter: null,
        template: content.trim()
      };
    }
  }

  /**
   * Validate Hook configuration
   */
  static async validateHook(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      let hookConfig;

      try {
        hookConfig = JSON.parse(content);
      } catch (error) {
        return {
          valid: false,
          errors: [`Invalid JSON format: ${error.message}`],
          type: 'hook'
        };
      }

      const validation = this.validateSchema(hookConfig, this.HOOK_SCHEMA);
      if (!validation.valid) {
        return {
          valid: false,
          errors: validation.errors,
          type: 'hook'
        };
      }

      // Validate hook condition syntax if present
      if (hookConfig.condition) {
        const conditionErrors = this.validateHookCondition(hookConfig.condition);
        if (conditionErrors.length > 0) {
          return {
            valid: false,
            errors: conditionErrors,
            type: 'hook'
          };
        }
      }

      return {
        valid: true,
        type: 'hook',
        data: {
          ...hookConfig,
          hash: this.generateHash(content)
        }
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`File parsing error: ${error.message}`],
        type: 'hook'
      };
    }
  }

  /**
   * Generic schema validation
   */
  static validateSchema(data, schema) {
    const errors = [];

    // Check required fields
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate field properties
    for (const [field, value] of Object.entries(data)) {
      const fieldSchema = schema.properties[field];
      if (!fieldSchema) continue;

      const fieldErrors = this.validateField(field, value, fieldSchema);
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual field
   */
  static validateField(fieldName, value, schema) {
    const errors = [];

    // Type validation
    if (schema.type === 'string' && typeof value !== 'string') {
      errors.push(`${fieldName} must be a string`);
      return errors;
    }

    if (schema.type === 'number' && typeof value !== 'number') {
      errors.push(`${fieldName} must be a number`);
      return errors;
    }

    if (schema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${fieldName} must be a boolean`);
      return errors;
    }

    if (schema.type === 'array' && !Array.isArray(value)) {
      errors.push(`${fieldName} must be an array`);
      return errors;
    }

    // String validations
    if (schema.type === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push(`${fieldName} must be at least ${schema.minLength} characters`);
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push(`${fieldName} must be at most ${schema.maxLength} characters`);
      }
      if (schema.pattern && !schema.pattern.test(value)) {
        errors.push(`${fieldName} has invalid format`);
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${fieldName} must be one of: ${schema.enum.join(', ')}`);
      }
    }

    // Number validations
    if (schema.type === 'number') {
      if (schema.minimum && value < schema.minimum) {
        errors.push(`${fieldName} must be at least ${schema.minimum}`);
      }
      if (schema.maximum && value > schema.maximum) {
        errors.push(`${fieldName} must be at most ${schema.maximum}`);
      }
    }

    // Array validations
    if (schema.type === 'array') {
      if (schema.maxItems && value.length > schema.maxItems) {
        errors.push(`${fieldName} must have at most ${schema.maxItems} items`);
      }
      if (schema.items) {
        // Validate array items
        for (let i = 0; i < value.length; i++) {
          if (schema.items.type) {
            const itemErrors = this.validateField(`${fieldName}[${i}]`, value[i], schema.items);
            errors.push(...itemErrors);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate agent-specific semantics
   */
  static validateAgentSemantics(metadata, content) {
    const errors = [];

    // Check if content provides meaningful instruction
    const instructionKeywords = ['you are', 'your role', 'you should', 'you will', 'focus on'];
    const hasInstructions = instructionKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );

    if (!hasInstructions) {
      errors.push('Agent content should provide clear instructions or role definition');
    }

    // Validate tool requirements
    if (metadata.tools && metadata.tools.length > 10) {
      errors.push('Agent should not require more than 10 tools');
    }

    // Check for potential conflicts
    if (metadata.model === 'opus' && metadata.classification === 'default') {
      errors.push('Opus model agents should typically be selectable, not default');
    }

    return errors;
  }

  /**
   * Validate command template
   */
  static validateCommandTemplate(template) {
    const errors = [];

    if (template.length < 10) {
      errors.push('Command template must be at least 10 characters');
    }

    // Check for parameter placeholders
    const parameterPattern = /\$[A-Z_]+/g;
    const parameters = template.match(parameterPattern) || [];
    
    if (parameters.length === 0) {
      errors.push('Command template should contain at least one parameter placeholder ($PARAMETER_NAME)');
    }

    // Validate parameter naming
    for (const param of parameters) {
      if (!/^\$[A-Z_]+$/.test(param)) {
        errors.push(`Invalid parameter format: ${param}. Use $UPPERCASE_NAME format`);
      }
    }

    return errors;
  }

  /**
   * Extract command parameters from template
   */
  static extractCommandParameters(template) {
    const parameterPattern = /\$([A-Z_]+)/g;
    const parameters = [];
    let match;

    while ((match = parameterPattern.exec(template)) !== null) {
      const paramName = match[1];
      if (!parameters.find(p => p.name === paramName)) {
        parameters.push({
          name: paramName,
          type: 'string',
          required: true,
          description: `Parameter ${paramName}`
        });
      }
    }

    return parameters;
  }

  /**
   * Extract metadata from command template
   */
  static extractCommandMetadata(template) {
    const lines = template.split('\n');
    const firstLine = lines[0];
    
    // Try to extract command name from first line
    const commandMatch = firstLine.match(/^\/([a-zA-Z0-9-_]+)/);
    const name = commandMatch ? commandMatch[1] : 'unnamed-command';
    
    return {
      name,
      description: `Command: ${firstLine}`,
      classification: 'selectable'
    };
  }

  /**
   * Validate hook condition syntax
   */
  static validateHookCondition(condition) {
    const errors = [];

    // Basic syntax validation
    const allowedTokens = /^[a-zA-Z0-9_\s=!<>()&|'".-]+$/;
    if (!allowedTokens.test(condition)) {
      errors.push('Hook condition contains invalid characters');
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /exec\s*\(/,
      /require\s*\(/,
      /import\s+/,
      /\.__proto__/,
      /\.constructor/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(condition)) {
        errors.push('Hook condition contains potentially dangerous code');
        break;
      }
    }

    return errors;
  }

  /**
   * Generate content hash for caching and change detection
   */
  static generateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate extension by file type
   */
  static async validateExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, ext);

    // Determine extension type by file extension and content
    if (ext === '.md') {
      return await this.validateAgent(filePath);
    } else if (ext === '.txt' || ext === '.cmd') {
      return await this.validateCommand(filePath);
    } else if (ext === '.json' && fileName.includes('hook')) {
      return await this.validateHook(filePath);
    } else {
      return {
        valid: false,
        errors: [`Unsupported extension file type: ${ext}`],
        type: 'unknown'
      };
    }
  }
}

export default ExtensionValidator;