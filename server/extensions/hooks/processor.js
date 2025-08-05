import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Hook Event Processor
 * Handles hook registration, execution, and event processing
 */
export default class HookEventProcessor {
  constructor(database, extensionManager) {
    this.db = database;
    this.extensionManager = extensionManager;
    this.registeredHooks = new Map();
    this.eventListeners = new Map();
    this.executionQueue = [];
    this.isProcessingQueue = false;
    
    // Available hook events and their descriptions
    this.availableEvents = {
      'PreToolUse': {
        description: 'Before any tool is executed',
        dataFormat: { tool: 'string', parameters: 'object', sessionId: 'string' }
      },
      'PostToolUse': {
        description: 'After tool execution completes',
        dataFormat: { tool: 'string', parameters: 'object', result: 'object', duration: 'number' }
      },
      'PreChatMessage': {
        description: 'Before sending message to Claude',
        dataFormat: { message: 'string', sessionId: 'string', timestamp: 'string' }
      },
      'PostChatMessage': {
        description: 'After receiving Claude response',
        dataFormat: { message: 'string', response: 'string', duration: 'number' }
      },
      'FileChange': {
        description: 'When project files are modified',
        dataFormat: { filePath: 'string', changeType: 'string', content: 'string' }
      },
      'GitCommit': {
        description: 'Before/after git commits',
        dataFormat: { commitMessage: 'string', files: 'array', hash: 'string' }
      },
      'ProjectLoad': {
        description: 'When project is loaded',
        dataFormat: { projectPath: 'string', fileCount: 'number', gitBranch: 'string' }
      },
      'SessionStart': {
        description: 'When new chat session starts',
        dataFormat: { sessionId: 'string', projectPath: 'string', timestamp: 'string' }
      },
      'SessionEnd': {
        description: 'When chat session ends',
        dataFormat: { sessionId: 'string', duration: 'number', messageCount: 'number' }
      },
      'Error': {
        description: 'When errors occur in the system',
        dataFormat: { error: 'string', source: 'string', severity: 'string', context: 'object' }
      }
    };

    this.initializeHooks();
  }

  /**
   * Initialize hooks from database
   */
  async initializeHooks() {
    try {
      const stmt = this.db.prepare('SELECT * FROM hooks WHERE enabled = 1');
      const enabledHooks = stmt.all();

      for (const hook of enabledHooks) {
        await this.registerHook(hook.id, {
          ...hook,
          conditionParams: hook.condition_params ? JSON.parse(hook.condition_params) : {}
        });
      }

      console.log(`🎣 Initialized ${enabledHooks.length} hooks`);
    } catch (error) {
      console.error('Failed to initialize hooks:', error);
    }
  }

  /**
   * Register a hook for event processing
   */
  async registerHook(hookId, hookConfig) {
    try {
      // Store hook configuration
      this.registeredHooks.set(hookId, {
        id: hookId,
        name: hookConfig.name,
        event: hookConfig.event,
        condition: hookConfig.condition || 'always',
        conditionParams: hookConfig.conditionParams || {},
        command: hookConfig.command,
        timeout: hookConfig.timeout || 30000,
        projectPath: hookConfig.project_path,
        enabled: hookConfig.enabled
      });

      // Register event listener
      if (!this.eventListeners.has(hookConfig.event)) {
        this.eventListeners.set(hookConfig.event, new Set());
      }
      this.eventListeners.get(hookConfig.event).add(hookId);

      console.log(`🎣 Registered hook ${hookConfig.name} for event ${hookConfig.event}`);
    } catch (error) {
      console.error(`Failed to register hook ${hookId}:`, error);
    }
  }

  /**
   * Unregister a hook
   */
  async unregisterHook(hookId) {
    try {
      const hook = this.registeredHooks.get(hookId);
      if (!hook) return;

      // Remove from event listeners
      const eventHooks = this.eventListeners.get(hook.event);
      if (eventHooks) {
        eventHooks.delete(hookId);
        if (eventHooks.size === 0) {
          this.eventListeners.delete(hook.event);
        }
      }

      // Remove from registered hooks
      this.registeredHooks.delete(hookId);

      console.log(`🎣 Unregistered hook ${hook.name}`);
    } catch (error) {
      console.error(`Failed to unregister hook ${hookId}:`, error);
    }
  }

  /**
   * Process an event and trigger matching hooks
   */
  async processEvent(eventType, eventData = {}, projectPath = null) {
    const results = [];

    try {
      const hookIds = this.eventListeners.get(eventType);
      if (!hookIds || hookIds.size === 0) {
        return results;
      }

      const context = {
        event: eventType,
        data: eventData,
        projectPath,
        timestamp: new Date().toISOString()
      };

      // Process each hook that listens to this event
      for (const hookId of hookIds) {
        const hook = this.registeredHooks.get(hookId);
        if (!hook || !hook.enabled) continue;

        // Check if hook applies to this project
        if (hook.projectPath && projectPath && hook.projectPath !== projectPath) {
          continue;
        }

        // Check hook condition
        if (!this.evaluateCondition(hook, context)) {
          continue;
        }

        // Execute hook
        const result = await this.executeHook(hook, context);
        results.push(result);

        // Log execution
        this.logHookExecution(hookId, result, context);
      }

      return results;
    } catch (error) {
      console.error(`Error processing event ${eventType}:`, error);
      return results;
    }
  }

  /**
   * Evaluate hook condition
   */
  evaluateCondition(hook, context) {
    try {
      switch (hook.condition) {
        case 'always':
          return true;

        case 'file_type':
          if (!context.data.filePath || !hook.conditionParams.extension) return false;
          const fileExt = path.extname(context.data.filePath).substring(1);
          return fileExt === hook.conditionParams.extension;

        case 'tool_name':
          if (!context.data.tool || !hook.conditionParams.tool) return false;
          return context.data.tool === hook.conditionParams.tool;

        case 'project_path':
          if (!context.projectPath || !hook.conditionParams.path) return false;
          return context.projectPath.includes(hook.conditionParams.path);

        case 'time_range':
          const now = new Date();
          const currentTime = now.getHours() * 100 + now.getMinutes();
          const startTime = this.parseTime(hook.conditionParams.start_time);
          const endTime = this.parseTime(hook.conditionParams.end_time);
          
          if (startTime <= endTime) {
            return currentTime >= startTime && currentTime <= endTime;
          } else {
            // Handle overnight ranges
            return currentTime >= startTime || currentTime <= endTime;
          }

        case 'custom':
          // Evaluate custom JavaScript condition
          return this.evaluateCustomCondition(hook.conditionParams.code, context);

        default:
          return true;
      }
    } catch (error) {
      console.error(`Error evaluating condition for hook ${hook.id}:`, error);
      return false;
    }
  }

  /**
   * Parse time string (HH:MM) to minutes since midnight
   */
  parseTime(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10));
    return hours * 100 + minutes;
  }

  /**
   * Evaluate custom JavaScript condition safely
   */
  evaluateCustomCondition(code, context) {
    try {
      // Create a safe context for evaluation
      const safeContext = {
        event: context.event,
        data: context.data,
        projectPath: context.projectPath,
        timestamp: context.timestamp,
        // Utility functions
        includes: (str, search) => str && str.includes(search),
        matches: (str, pattern) => str && new RegExp(pattern).test(str),
        length: (arr) => arr && arr.length || 0
      };

      // Use Function constructor for safer evaluation than eval
      const conditionFunction = new Function('context', `
        const { event, data, projectPath, timestamp, includes, matches, length } = context;
        return ${code};
      `);

      return Boolean(conditionFunction(safeContext));
    } catch (error) {
      console.error('Error evaluating custom condition:', error);
      return false;
    }
  }

  /**
   * Execute a hook command
   */
  async executeHook(hook, context) {
    const startTime = Date.now();
    let result = {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      output: '',
      error: null,
      executionTime: 0
    };

    try {
      // Replace context variables in command
      const command = this.interpolateCommand(hook.command, context);

      // Set up execution environment
      const workingDir = context.projectPath || process.cwd();
      const env = {
        ...process.env,
        HOOK_EVENT: context.event,
        HOOK_PROJECT_PATH: context.projectPath || '',
        HOOK_TIMESTAMP: context.timestamp,
        HOOK_DATA: JSON.stringify(context.data)
      };

      // Execute command
      const executionResult = await this.runCommand(command, {
        cwd: workingDir,
        env,
        timeout: hook.timeout
      });

      result.success = executionResult.exitCode === 0;
      result.output = executionResult.stdout;
      result.error = executionResult.stderr;

    } catch (error) {
      result.success = false;
      result.error = error.message;
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Interpolate command with context variables
   */
  interpolateCommand(command, context) {
    let interpolated = command;

    // Replace context variables
    interpolated = interpolated.replace(/\$\{event\}/g, context.event);
    interpolated = interpolated.replace(/\$\{projectPath\}/g, context.projectPath || '');
    interpolated = interpolated.replace(/\$\{timestamp\}/g, context.timestamp);

    // Replace data variables
    if (context.data) {
      Object.entries(context.data).forEach(([key, value]) => {
        const placeholder = new RegExp(`\\$\\{data\\.${key}\\}`, 'g');
        interpolated = interpolated.replace(placeholder, String(value || ''));
      });
    }

    // Replace environment variables
    interpolated = interpolated.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
      return process.env[varName] || match;
    });

    return interpolated;
  }

  /**
   * Run shell command with timeout
   */
  runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const { cwd = process.cwd(), env = process.env, timeout = 30000 } = options;

      // Determine shell based on platform
      const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
      const shellArg = os.platform() === 'win32' ? '/c' : '-c';

      const child = spawn(shell, [shellArg, command], {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set up timeout
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      // Collect output
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        
        if (timedOut) {
          reject(new Error(`Command timed out after ${timeout}ms`));
        } else {
          resolve({
            exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Test hook execution with mock data
   */
  async testHook(hookId, testContext) {
    const hook = this.registeredHooks.get(hookId);
    if (!hook) {
      throw new Error('Hook not found');
    }

    const context = {
      event: testContext.event,
      data: testContext.data || {},
      projectPath: testContext.projectPath,
      timestamp: new Date().toISOString()
    };

    // Check condition evaluation
    const conditionMet = this.evaluateCondition(hook, context);
    if (!conditionMet) {
      return {
        success: false,
        error: 'Hook condition not met',
        executionTime: 0,
        output: 'Condition evaluation failed'
      };
    }

    // Execute hook
    return await this.executeHook(hook, context);
  }

  /**
   * Log hook execution to database
   */
  logHookExecution(hookId, result, context) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO hook_logs (
          hook_id, event_type, status, execution_time, 
          error_message, metadata, project_path
        ) VALUES (?, 'execution', ?, ?, ?, ?, ?)
      `);

      stmt.run(
        hookId,
        result.success ? 'success' : 'error',
        result.executionTime,
        result.error,
        JSON.stringify({
          event: context.event,
          output: result.output?.substring(0, 1000), // Store first 1000 chars
          command: this.registeredHooks.get(hookId)?.command,
          timestamp: context.timestamp
        }),
        context.projectPath
      );
    } catch (error) {
      console.error('Failed to log hook execution:', error);
    }
  }

  /**
   * Get available events
   */
  getAvailableEvents() {
    return this.availableEvents;
  }

  /**
   * Get registered hook count by event
   */
  getHookCountByEvent() {
    const counts = {};
    
    Object.keys(this.availableEvents).forEach(event => {
      const hookIds = this.eventListeners.get(event);
      counts[event] = hookIds ? hookIds.size : 0;
    });

    return counts;
  }

  /**
   * Get hook execution statistics
   */
  getExecutionStatistics(days = 7) {
    const stmt = this.db.prepare(`
      SELECT 
        h.name,
        h.event,
        COUNT(l.id) as execution_count,
        AVG(l.execution_time) as avg_duration,
        SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) as success_count,
        MAX(l.created_at) as last_execution
      FROM hooks h
      LEFT JOIN hook_logs l ON h.id = l.hook_id 
        AND l.event_type = 'execution'
        AND l.created_at >= datetime('now', '-${days} days')
      WHERE h.enabled = 1
      GROUP BY h.id, h.name, h.event
      ORDER BY execution_count DESC
    `);

    return stmt.all();
  }

  /**
   * Cleanup old hook logs
   */
  async cleanupOldLogs(retentionDays = 30) {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM hook_logs 
        WHERE created_at < datetime('now', '-${retentionDays} days')
      `);
      
      const result = stmt.run();
      console.log(`🧹 Cleaned up ${result.changes} old hook logs`);
      
      return result.changes;
    } catch (error) {
      console.error('Failed to cleanup old hook logs:', error);
      return 0;
    }
  }
}