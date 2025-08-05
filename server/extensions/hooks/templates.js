/**
 * Hook Template Library
 * Pre-built hook configurations for common workflows
 */

export const HOOK_TEMPLATES = {
  // Development Workflow Templates
  development: {
    name: 'Development Workflow',
    description: 'Templates for development process automation',
    templates: [
      {
        name: 'Pre-commit Linting',
        description: 'Run linting before git commits to ensure code quality',
        event: 'GitCommit',
        condition: 'always',
        command: 'npm run lint',
        timeout: 60000,
        tags: ['git', 'linting', 'quality'],
        variables: [],
        example: {
          description: 'Automatically runs ESLint before each commit',
          projectTypes: ['javascript', 'typescript', 'react', 'vue']
        }
      },
      {
        name: 'Pre-commit Testing',
        description: 'Run tests before git commits to prevent broken code',
        event: 'GitCommit',
        condition: 'always',
        command: 'npm test -- --passWithNoTests',
        timeout: 120000,
        tags: ['git', 'testing', 'quality'],
        variables: [],
        example: {
          description: 'Runs Jest tests before committing changes',
          projectTypes: ['javascript', 'typescript', 'react', 'node']
        }
      },
      {
        name: 'TypeScript Type Check',
        description: 'Verify TypeScript types before tool execution',
        event: 'PreToolUse',
        condition: 'file_type',
        conditionParams: { extension: 'ts' },
        command: 'npx tsc --noEmit',
        timeout: 45000,
        tags: ['typescript', 'type-checking', 'quality'],
        variables: [
          { name: 'extension', description: 'File extension to check', example: 'ts' }
        ],
        example: {
          description: 'Checks TypeScript types when working with .ts files',
          projectTypes: ['typescript', 'react-ts', 'node-ts']
        }
      },
      {
        name: 'Auto Format on Save',
        description: 'Automatically format code when files change',
        event: 'FileChange',
        condition: 'file_type',
        conditionParams: { extension: 'js' },
        command: 'npx prettier --write "${data.filePath}"',
        timeout: 15000,
        tags: ['formatting', 'prettier', 'auto-format'],
        variables: [
          { name: 'extension', description: 'File extension to format', example: 'js' }
        ],
        example: {
          description: 'Runs Prettier on JavaScript files when they change',
          projectTypes: ['javascript', 'react', 'vue', 'svelte']
        }
      }
    ]
  },

  // Quality Assurance Templates
  quality: {
    name: 'Quality Assurance',
    description: 'Templates for maintaining code quality and standards',
    templates: [
      {
        name: 'Security Audit',
        description: 'Run security audit before deployments',
        event: 'PostToolUse',
        condition: 'tool_name',
        conditionParams: { tool: 'Build' },
        command: 'npm audit --audit-level=high',
        timeout: 90000,
        tags: ['security', 'audit', 'npm'],
        variables: [
          { name: 'tool', description: 'Tool name to trigger on', example: 'Build' }
        ],
        example: {
          description: 'Checks for security vulnerabilities after builds',
          projectTypes: ['node', 'javascript', 'react', 'vue']
        }
      },
      {
        name: 'Bundle Size Check',
        description: 'Check bundle size after builds',
        event: 'PostToolUse',
        condition: 'tool_name',
        conditionParams: { tool: 'Build' },
        command: 'npx bundlesize',
        timeout: 30000,
        tags: ['performance', 'bundle-size', 'optimization'],
        variables: [
          { name: 'tool', description: 'Tool name to trigger on', example: 'Build' }
        ],
        example: {
          description: 'Monitors bundle size to prevent performance regressions',
          projectTypes: ['react', 'vue', 'angular', 'webpack']
        }
      },
      {
        name: 'Code Coverage Check',
        description: 'Ensure code coverage meets minimum threshold',
        event: 'PostToolUse',
        condition: 'tool_name',
        conditionParams: { tool: 'Test' },
        command: 'npx nyc check-coverage --lines 80 --functions 80 --branches 80',
        timeout: 15000,
        tags: ['testing', 'coverage', 'quality'],
        variables: [
          { name: 'tool', description: 'Tool name to trigger on', example: 'Test' }
        ],
        example: {
          description: 'Fails if code coverage drops below 80%',
          projectTypes: ['javascript', 'typescript', 'node']
        }
      }
    ]
  },

  // Notification Templates
  notifications: {
    name: 'Notifications',
    description: 'Templates for sending notifications and alerts',
    templates: [
      {
        name: 'Slack Build Notification',
        description: 'Send Slack notification when builds complete',
        event: 'PostToolUse',
        condition: 'tool_name',
        conditionParams: { tool: 'Build' },
        command: 'curl -X POST -H "Content-type: application/json" --data "{\\"text\\":\\"Build completed for ${projectPath}\\"}" $SLACK_WEBHOOK_URL',
        timeout: 10000,
        tags: ['slack', 'notifications', 'builds'],
        variables: [
          { name: 'tool', description: 'Tool name to trigger on', example: 'Build' },
          { name: 'SLACK_WEBHOOK_URL', description: 'Slack webhook URL environment variable', example: 'https://hooks.slack.com/...' }
        ],
        example: {
          description: 'Posts build status to Slack channel',
          projectTypes: ['any']
        }
      },
      {
        name: 'Email Error Alert',
        description: 'Send email when errors occur',
        event: 'Error',
        condition: 'always',
        command: 'echo "Error occurred: ${data.error}" | mail -s "Claude Code Error Alert" $ADMIN_EMAIL',
        timeout: 15000,
        tags: ['email', 'alerts', 'errors'],
        variables: [
          { name: 'ADMIN_EMAIL', description: 'Admin email environment variable', example: 'admin@example.com' }
        ],
        example: {
          description: 'Sends email alerts for system errors',
          projectTypes: ['any']
        }
      },
      {
        name: 'Discord Deployment Notice',
        description: 'Post deployment notifications to Discord',
        event: 'PostToolUse',
        condition: 'custom',
        conditionParams: { code: 'data.tool === "Deploy" && data.result?.success' },
        command: 'curl -H "Content-Type: application/json" -X POST -d "{\\"content\\":\\"🚀 Deployment successful for ${projectPath}\\"}" $DISCORD_WEBHOOK_URL',
        timeout: 10000,
        tags: ['discord', 'deployment', 'notifications'],
        variables: [
          { name: 'DISCORD_WEBHOOK_URL', description: 'Discord webhook URL environment variable', example: 'https://discord.com/api/webhooks/...' }
        ],
        example: {
          description: 'Notifies Discord channel of successful deployments',
          projectTypes: ['any']
        }
      }
    ]
  },

  // Monitoring Templates
  monitoring: {
    name: 'Monitoring',
    description: 'Templates for monitoring and logging system events',
    templates: [
      {
        name: 'Performance Logging',
        description: 'Log performance metrics for chat sessions',
        event: 'SessionEnd',
        condition: 'always',
        command: 'echo "Session ${data.sessionId}: ${data.duration}ms, ${data.messageCount} messages" >> performance.log',
        timeout: 5000,
        tags: ['logging', 'performance', 'metrics'],
        variables: [],
        example: {
          description: 'Tracks chat session performance metrics',
          projectTypes: ['any']
        }
      },
      {
        name: 'File Change Audit',
        description: 'Audit all file changes for compliance',
        event: 'FileChange',
        condition: 'always',
        command: 'echo "$(date): ${data.changeType} - ${data.filePath}" >> audit.log',
        timeout: 5000,
        tags: ['audit', 'compliance', 'logging'],
        variables: [],
        example: {
          description: 'Maintains audit trail of all file modifications',
          projectTypes: ['any']
        }
      },
      {
        name: 'Resource Usage Monitor',
        description: 'Monitor system resource usage during tool execution',
        event: 'PreToolUse',
        condition: 'always',
        command: 'echo "Tool: ${data.tool}, Memory: $(free -m | awk "NR==2{printf \\"%.1f%%\\", $3*100/$2}"), CPU: $(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk "{print 100 - $1}")%" >> resource.log',
        timeout: 10000,
        tags: ['monitoring', 'resources', 'performance'],
        variables: [],
        example: {
          description: 'Logs system resource usage before tool execution',
          projectTypes: ['any']
        }
      }
    ]
  },

  // Deployment Templates
  deployment: {
    name: 'Deployment',
    description: 'Templates for deployment and release automation',
    templates: [
      {
        name: 'Pre-deployment Health Check',
        description: 'Run health checks before deployment',
        event: 'PreToolUse',
        condition: 'tool_name',
        conditionParams: { tool: 'Deploy' },
        command: 'npm run health-check && npm run smoke-tests',
        timeout: 180000,
        tags: ['deployment', 'health-check', 'testing'],
        variables: [
          { name: 'tool', description: 'Tool name to trigger on', example: 'Deploy' }
        ],
        example: {
          description: 'Ensures system health before deployments',
          projectTypes: ['node', 'web-app', 'api']
        }
      },
      {
        name: 'Database Migration',
        description: 'Run database migrations before deployment',
        event: 'PreToolUse',
        condition: 'tool_name',
        conditionParams: { tool: 'Deploy' },
        command: 'npm run db:migrate',
        timeout: 300000,
        tags: ['deployment', 'database', 'migration'],
        variables: [
          { name: 'tool', description: 'Tool name to trigger on', example: 'Deploy' }
        ],
        example: {
          description: 'Applies database schema changes before deployment',
          projectTypes: ['api', 'web-app', 'database']
        }
      },
      {
        name: 'Cache Invalidation',
        description: 'Clear caches after successful deployment',
        event: 'PostToolUse',
        condition: 'custom',
        conditionParams: { code: 'data.tool === "Deploy" && data.result?.success' },
        command: 'curl -X POST "$CACHE_INVALIDATION_URL" -H "Authorization: Bearer $CACHE_TOKEN"',
        timeout: 30000,
        tags: ['deployment', 'cache', 'invalidation'],
        variables: [
          { name: 'CACHE_INVALIDATION_URL', description: 'Cache invalidation endpoint', example: 'https://api.cloudflare.com/purge' },
          { name: 'CACHE_TOKEN', description: 'Cache service authentication token', example: 'your-token-here' }
        ],
        example: {
          description: 'Clears CDN and application caches after deployment',
          projectTypes: ['web-app', 'api', 'static-site']
        }
      }
    ]
  },

  // Backup Templates
  backup: {
    name: 'Backup & Recovery',
    description: 'Templates for backup and recovery automation',
    templates: [
      {
        name: 'Project Backup',
        description: 'Create project backup when session starts',
        event: 'SessionStart',
        condition: 'always',
        command: 'tar -czf "backup-$(date +%Y%m%d-%H%M%S).tar.gz" --exclude=node_modules --exclude=.git .',
        timeout: 120000,
        tags: ['backup', 'archive', 'safety'],
        variables: [],
        example: {
          description: 'Creates compressed backup of project files',
          projectTypes: ['any']
        }
      },
      {
        name: 'Configuration Snapshot',
        description: 'Save configuration snapshot before changes',
        event: 'PreToolUse',
        condition: 'custom',
        conditionParams: { code: 'data.tool === "Edit" && data.parameters?.file_path?.includes("config")' },
        command: 'cp "${data.parameters.file_path}" "${data.parameters.file_path}.backup.$(date +%Y%m%d-%H%M%S)"',
        timeout: 10000,
        tags: ['backup', 'configuration', 'safety'],
        variables: [],
        example: {
          description: 'Backs up configuration files before editing',
          projectTypes: ['any']
        }
      },
      {
        name: 'Database Backup',
        description: 'Create database backup before schema changes',
        event: 'PreToolUse',
        condition: 'custom',
        conditionParams: { code: 'data.parameters?.command?.includes("migrate") || data.parameters?.command?.includes("schema")' },
        command: 'pg_dump $DATABASE_URL > "db-backup-$(date +%Y%m%d-%H%M%S).sql"',
        timeout: 180000,
        tags: ['backup', 'database', 'migration'],
        variables: [
          { name: 'DATABASE_URL', description: 'Database connection URL', example: 'postgresql://user:pass@localhost/db' }
        ],
        example: {
          description: 'Creates database backup before migrations',
          projectTypes: ['api', 'web-app', 'database']
        }
      }
    ]
  }
};

/**
 * Hook Template Library Class
 */
export default class HookTemplateLibrary {
  constructor() {
    this.templates = HOOK_TEMPLATES;
  }

  /**
   * Get all available hook templates
   */
  getAllTemplates() {
    const allTemplates = [];
    
    Object.entries(this.templates).forEach(([categoryKey, category]) => {
      category.templates.forEach(template => {
        allTemplates.push({
          ...template,
          category: category.name,
          categoryKey,
          id: `${categoryKey}-${template.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        });
      });
    });
    
    return allTemplates;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(categoryKey) {
    const category = this.templates[categoryKey];
    if (!category) return [];

    return category.templates.map(template => ({
      ...template,
      category: category.name,
      categoryKey,
      id: `${categoryKey}-${template.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    }));
  }

  /**
   * Get template categories
   */
  getTemplateCategories() {
    return Object.entries(this.templates).map(([key, category]) => ({
      key,
      name: category.name,
      description: category.description,
      count: category.templates.length
    }));
  }

  /**
   * Search templates by keyword
   */
  searchTemplates(query) {
    const allTemplates = this.getAllTemplates();
    const lowerQuery = query.toLowerCase();
    
    return allTemplates.filter(template => 
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      template.event.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get template by ID
   */
  getTemplateById(templateId) {
    const allTemplates = this.getAllTemplates();
    return allTemplates.find(template => template.id === templateId);
  }

  /**
   * Get templates by event type
   */
  getTemplatesByEvent(eventType) {
    const allTemplates = this.getAllTemplates();
    return allTemplates.filter(template => template.event === eventType);
  }

  /**
   * Get templates by tags
   */
  getTemplatesByTags(tags) {
    const allTemplates = this.getAllTemplates();
    const tagSet = new Set(tags.map(tag => tag.toLowerCase()));
    
    return allTemplates.filter(template => 
      template.tags.some(tag => tagSet.has(tag.toLowerCase()))
    );
  }

  /**
   * Get popular templates (most commonly used)
   */
  getPopularTemplates(limit = 10) {
    // For now, return a curated list of popular templates
    const popularIds = [
      'development-pre-commit-linting',
      'development-pre-commit-testing',
      'quality-security-audit',
      'notifications-slack-build-notification',
      'monitoring-performance-logging',
      'deployment-pre-deployment-health-check',
      'backup-project-backup'
    ];

    const allTemplates = this.getAllTemplates();
    const popular = popularIds
      .map(id => allTemplates.find(t => t.id === id))
      .filter(Boolean)
      .slice(0, limit);

    return popular;
  }

  /**
   * Validate template configuration
   */
  validateTemplate(template) {
    const errors = [];

    // Required fields
    if (!template.name) errors.push('Template name is required');
    if (!template.description) errors.push('Template description is required');
    if (!template.event) errors.push('Template event is required');
    if (!template.command) errors.push('Template command is required');

    // Event validation
    const validEvents = [
      'PreToolUse', 'PostToolUse', 'PreChatMessage', 'PostChatMessage',
      'FileChange', 'GitCommit', 'ProjectLoad', 'SessionStart', 
      'SessionEnd', 'Error'
    ];
    if (template.event && !validEvents.includes(template.event)) {
      errors.push(`Invalid event type: ${template.event}`);
    }

    // Timeout validation
    if (template.timeout && (template.timeout < 1000 || template.timeout > 300000)) {
      errors.push('Timeout must be between 1000ms and 300000ms');
    }

    // Condition validation
    if (template.condition && !['always', 'file_type', 'tool_name', 'project_path', 'time_range', 'custom'].includes(template.condition)) {
      errors.push(`Invalid condition type: ${template.condition}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate hook configuration from template
   */
  generateHookFromTemplate(templateId, customization = {}) {
    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const hookConfig = {
      name: customization.name || template.name,
      description: customization.description || template.description,
      event: template.event,
      condition: customization.condition || template.condition || 'always',
      conditionParams: customization.conditionParams || template.conditionParams || {},
      command: customization.command || template.command,
      timeout: customization.timeout || template.timeout || 30000,
      enabled: customization.enabled !== undefined ? customization.enabled : true,
      project_path: customization.project_path || null
    };

    // Validate generated configuration
    const validation = this.validateTemplate(hookConfig);
    if (!validation.valid) {
      throw new Error(`Generated hook configuration is invalid: ${validation.errors.join(', ')}`);
    }

    return hookConfig;
  }
}