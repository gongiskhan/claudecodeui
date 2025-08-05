import { spawn } from 'child_process';
import os from 'os';

/**
 * Workflow Processor
 * Handles workflow registration, execution, and event processing
 */
export default class WorkflowProcessor {
  constructor(database, hookProcessor = null) {
    this.db = database;
    this.hookProcessor = hookProcessor;
    this.registeredWorkflows = new Map();
    this.eventListeners = new Map();
    this.executionQueue = [];
    this.isProcessingQueue = false;
    
    // Available events that can trigger workflows
    this.availableEvents = [
      'PreToolUse', 'PostToolUse', 'PreChatMessage', 'PostChatMessage',
      'FileChange', 'GitCommit', 'ProjectLoad', 'SessionStart', 
      'SessionEnd', 'Error'
    ];

    this.initializeWorkflows();
  }

  /**
   * Initialize workflows from database
   */
  async initializeWorkflows() {
    try {
      const stmt = this.db.prepare('SELECT * FROM workflows WHERE enabled = 1');
      const enabledWorkflows = stmt.all();

      for (const workflow of enabledWorkflows) {
        await this.registerWorkflow(workflow.id, {
          ...workflow,
          trigger: JSON.parse(workflow.trigger),
          steps: JSON.parse(workflow.steps),
          settings: JSON.parse(workflow.settings)
        });
      }

      console.log(`🔄 Initialized ${enabledWorkflows.length} workflows`);
    } catch (error) {
      console.error('Failed to initialize workflows:', error);
    }
  }

  /**
   * Register a workflow for event processing
   */
  async registerWorkflow(workflowId, workflowConfig) {
    try {
      // Store workflow configuration
      this.registeredWorkflows.set(workflowId, {
        id: workflowId,
        name: workflowConfig.name,
        description: workflowConfig.description,
        trigger: workflowConfig.trigger,
        steps: workflowConfig.steps,
        settings: workflowConfig.settings || {},
        projectPath: workflowConfig.project_path,
        enabled: workflowConfig.enabled
      });

      // Register event listener
      const triggerEvent = workflowConfig.trigger.event;
      if (!this.eventListeners.has(triggerEvent)) {
        this.eventListeners.set(triggerEvent, new Set());
      }
      this.eventListeners.get(triggerEvent).add(workflowId);

      console.log(`🔄 Registered workflow ${workflowConfig.name} for event ${triggerEvent}`);
    } catch (error) {
      console.error(`Failed to register workflow ${workflowId}:`, error);
    }
  }

  /**
   * Unregister a workflow
   */
  async unregisterWorkflow(workflowId) {
    try {
      const workflow = this.registeredWorkflows.get(workflowId);
      if (!workflow) return;

      // Remove from event listeners
      const triggerEvent = workflow.trigger.event;
      const eventWorkflows = this.eventListeners.get(triggerEvent);
      if (eventWorkflows) {
        eventWorkflows.delete(workflowId);
        if (eventWorkflows.size === 0) {
          this.eventListeners.delete(triggerEvent);
        }
      }

      // Remove from registered workflows
      this.registeredWorkflows.delete(workflowId);

      console.log(`🔄 Unregistered workflow ${workflow.name}`);
    } catch (error) {
      console.error(`Failed to unregister workflow ${workflowId}:`, error);
    }
  }

  /**
   * Process an event and trigger matching workflows
   */
  async processEvent(eventType, eventData = {}, projectPath = null) {
    const results = [];

    try {
      const workflowIds = this.eventListeners.get(eventType);
      if (!workflowIds || workflowIds.size === 0) {
        return results;
      }

      const context = {
        event: eventType,
        data: eventData,
        projectPath,
        timestamp: new Date().toISOString()
      };

      // Process each workflow that listens to this event
      for (const workflowId of workflowIds) {
        const workflow = this.registeredWorkflows.get(workflowId);
        if (!workflow || !workflow.enabled) continue;

        // Check if workflow applies to this project
        if (workflow.projectPath && projectPath && workflow.projectPath !== projectPath) {
          continue;
        }

        // Check trigger condition
        if (!this.evaluateCondition(workflow.trigger, context)) {
          continue;
        }

        // Execute workflow
        const result = await this.executeWorkflow(workflow, context);
        results.push(result);

        // Log execution
        this.logWorkflowExecution(workflowId, result, context);
      }

      return results;
    } catch (error) {
      console.error(`Error processing event ${eventType}:`, error);
      return results;
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflow, context) {
    const startTime = Date.now();
    let result = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      success: false,
      stepResults: [],
      error: null,
      executionTime: 0
    };

    try {
      const settings = workflow.settings || {};
      const parallel = settings.parallel || false;
      const stopOnError = settings.stopOnError !== false; // Default true

      if (parallel) {
        // Execute steps in parallel
        result.stepResults = await this.executeStepsParallel(workflow.steps, context, stopOnError);
      } else {
        // Execute steps sequentially
        result.stepResults = await this.executeStepsSequential(workflow.steps, context, stopOnError);
      }

      // Check overall success
      result.success = result.stepResults.every(stepResult => 
        stepResult.success || stepResult.continueOnError
      );

      if (!result.success && stopOnError) {
        const failedStep = result.stepResults.find(sr => !sr.success && !sr.continueOnError);
        result.error = `Step "${failedStep.stepName}" failed: ${failedStep.error}`;
      }

    } catch (error) {
      result.success = false;
      result.error = error.message;
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Execute workflow steps sequentially
   */
  async executeStepsSequential(steps, context, stopOnError) {
    const stepResults = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const result = await this.executeStep(step, context, i + 1);
      stepResults.push(result);

      // Stop if step failed and stopOnError is true and step doesn't have continueOnError
      if (!result.success && stopOnError && !step.continueOnError) {
        // Mark remaining steps as skipped
        for (let j = i + 1; j < steps.length; j++) {
          stepResults.push({
            stepId: steps[j].id,
            stepName: steps[j].name || `Step ${j + 1}`,
            success: false,
            skipped: true,
            output: '',
            error: 'Skipped due to previous step failure',
            executionTime: 0
          });
        }
        break;
      }
    }

    return stepResults;
  }

  /**
   * Execute workflow steps in parallel
   */
  async executeStepsParallel(steps, context, stopOnError) {
    const stepPromises = steps.map((step, index) => 
      this.executeStep(step, context, index + 1)
    );

    const stepResults = await Promise.all(stepPromises);

    return stepResults;
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(step, context, stepNumber) {
    const startTime = Date.now();
    let result = {
      stepId: step.id,
      stepName: step.name || `Step ${stepNumber}`,
      success: false,
      output: '',
      error: null,
      executionTime: 0,
      continueOnError: step.continueOnError || false
    };

    try {
      // Apply retries
      const maxRetries = step.retries || 0;
      let attempt = 0;
      let lastError = null;

      while (attempt <= maxRetries) {
        try {
          if (step.type === 'hook' && step.hookId) {
            // Execute existing hook
            result = await this.executeHookStep(step, context);
          } else {
            // Execute custom command
            result = await this.executeCommandStep(step, context);
          }

          if (result.success) {
            break; // Success, no need to retry
          } else {
            lastError = result.error;
          }
        } catch (error) {
          lastError = error.message;
        }

        attempt++;
        if (attempt <= maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!result.success) {
        result.error = lastError || 'Step execution failed';
      }

    } catch (error) {
      result.success = false;
      result.error = error.message;
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * Execute a hook step
   */
  async executeHookStep(step, context) {
    // If we have a hook processor, delegate to it
    if (this.hookProcessor) {
      try {
        const hookResult = await this.hookProcessor.testHook(step.hookId, {
          event: context.event,
          data: context.data,
          projectPath: context.projectPath
        });

        return {
          stepId: step.id,
          stepName: step.name,
          success: hookResult.success,
          output: hookResult.output || '',
          error: hookResult.error,
          executionTime: hookResult.executionTime || 0,
          continueOnError: step.continueOnError || false
        };
      } catch (error) {
        return {
          stepId: step.id,
          stepName: step.name,  
          success: false,
          output: '',
          error: `Hook execution failed: ${error.message}`,
          executionTime: 0,
          continueOnError: step.continueOnError || false
        };
      }
    }

    // Fallback: treat as command step
    return await this.executeCommandStep({
      ...step,
      command: step.command || `echo "Hook ${step.hookId} not available"`
    }, context);
  }

  /**
   * Execute a command step
   */
  async executeCommandStep(step, context) {
    const command = this.interpolateCommand(step.command, context);
    const timeout = step.timeout || 30000;
    const workingDir = context.projectPath || process.cwd();

    try {
      const executionResult = await this.runCommand(command, {
        cwd: workingDir,
        timeout,
        env: {
          ...process.env,
          WORKFLOW_EVENT: context.event,
          WORKFLOW_PROJECT_PATH: context.projectPath || '',
          WORKFLOW_TIMESTAMP: context.timestamp,
          WORKFLOW_DATA: JSON.stringify(context.data)
        }
      });

      return {
        stepId: step.id,
        stepName: step.name,
        success: executionResult.exitCode === 0,
        output: executionResult.stdout,
        error: executionResult.exitCode !== 0 ? executionResult.stderr : null,
        executionTime: executionResult.executionTime || 0,
        continueOnError: step.continueOnError || false
      };
    } catch (error) {
      return {
        stepId: step.id,
        stepName: step.name,
        success: false,
        output: '',
        error: error.message,
        executionTime: 0,
        continueOnError: step.continueOnError || false
      };
    }
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
      const startTime = Date.now();

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
        
        const executionTime = Date.now() - startTime;
        
        if (timedOut) {
          reject(new Error(`Command timed out after ${timeout}ms`));
        } else {
          resolve({
            exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            executionTime
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
   * Evaluate trigger condition
   */
  evaluateCondition(trigger, context) {
    try {
      const condition = trigger.condition || 'always';

      switch (condition) {
        case 'always':
          return true;

        case 'file_type':
          if (!context.data.filePath || !trigger.conditionParams?.extension) return false;
          const fileExt = context.data.filePath.split('.').pop();
          return fileExt === trigger.conditionParams.extension;

        case 'tool_name':
          if (!context.data.tool || !trigger.conditionParams?.tool) return false;
          return context.data.tool === trigger.conditionParams.tool;

        case 'project_path':
          if (!context.projectPath || !trigger.conditionParams?.path) return false;
          return context.projectPath.includes(trigger.conditionParams.path);

        case 'custom':
          return this.evaluateCustomCondition(trigger.conditionParams?.code, context);

        default:
          return true;
      }
    } catch (error) {
      console.error(`Error evaluating workflow trigger condition:`, error);
      return false;
    }
  }

  /**
   * Evaluate custom JavaScript condition safely
   */
  evaluateCustomCondition(code, context) {
    if (!code) return true;

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
      console.error('Error evaluating custom workflow condition:', error);
      return false;
    }
  }

  /**
   * Test workflow execution with mock data
   */
  async testWorkflow(workflowId, testContext, workflowOverride = null) {
    let workflow = workflowOverride;
    
    if (!workflow) {
      workflow = this.registeredWorkflows.get(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }
    }

    const context = {
      event: testContext.trigger?.event || testContext.event,
      data: testContext.data || {},
      projectPath: testContext.projectPath,
      timestamp: new Date().toISOString()
    };

    // Check condition evaluation
    const conditionMet = this.evaluateCondition(workflow.trigger, context);
    if (!conditionMet) {
      return {
        success: false,
        error: 'Workflow trigger condition not met',
        executionTime: 0,
        stepResults: []
      };
    }

    // Execute workflow
    return await this.executeWorkflow(workflow, context);
  }

  /**
   * Log workflow execution to database
   */
  logWorkflowExecution(workflowId, result, context) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO workflow_logs (
          workflow_id, event_type, status, execution_time, 
          error_message, metadata, project_path
        ) VALUES (?, 'execution', ?, ?, ?, ?, ?)
      `);

      stmt.run(
        workflowId,
        result.success ? 'success' : 'error',
        result.executionTime,
        result.error,
        JSON.stringify({
          event: context.event,
          stepResults: result.stepResults.map(sr => ({
            stepId: sr.stepId,
            stepName: sr.stepName,
            success: sr.success,
            executionTime: sr.executionTime,
            error: sr.error
          })),
          timestamp: context.timestamp
        }),
        context.projectPath
      );
    } catch (error) {
      console.error('Failed to log workflow execution:', error);
    }
  }

  /**
   * Get available events
   */
  getAvailableEvents() {
    return this.availableEvents;  
  }

  /**
   * Get workflow execution statistics
   */
  getExecutionStatistics(days = 7) {
    const stmt = this.db.prepare(`
      SELECT 
        w.name,
        w.enabled,
        COUNT(l.id) as execution_count,
        AVG(l.execution_time) as avg_duration,
        SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) as success_count,
        MAX(l.created_at) as last_execution
      FROM workflows w
      LEFT JOIN workflow_logs l ON w.id = l.workflow_id 
        AND l.event_type = 'execution'
        AND l.created_at >= datetime('now', '-${days} days')
      GROUP BY w.id, w.name, w.enabled
      ORDER BY execution_count DESC
    `);

    return stmt.all();
  }

  /**
   * Cleanup old workflow logs
   */
  async cleanupOldLogs(retentionDays = 30) {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM workflow_logs 
        WHERE created_at < datetime('now', '-${retentionDays} days')
      `);
      
      const result = stmt.run();
      console.log(`🧹 Cleaned up ${result.changes} old workflow logs`);
      
      return result.changes;
    } catch (error) {
      console.error('Failed to cleanup old workflow logs:', error);
      return 0;
    }
  }
}