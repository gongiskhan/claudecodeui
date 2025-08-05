import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Play, Save, X, ArrowDown, ArrowRight, 
  Settings, Clock, Zap, AlertTriangle, CheckCircle, 
  Edit3, Copy, Move3D, ChevronDown, ChevronRight
} from 'lucide-react';

function WorkflowBuilder({ onSave, onCancel, initialWorkflow = null }) {
  const [workflow, setWorkflow] = useState({
    name: initialWorkflow?.name || '',
    description: initialWorkflow?.description || '',
    trigger: initialWorkflow?.trigger || { event: 'PreToolUse', condition: 'always' },
    steps: initialWorkflow?.steps || [],
    enabled: initialWorkflow?.enabled !== undefined ? initialWorkflow.enabled : true,
    settings: initialWorkflow?.settings || {
      parallel: false,
      stopOnError: true,
      timeout: 300000 // 5 minutes
    }
  });

  const [availableHooks, setAvailableHooks] = useState([]);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [draggedStep, setDraggedStep] = useState(null);
  const [expanded, setExpanded] = useState({});

  // Load available hooks
  useEffect(() => {
    loadHooks();
  }, []);

  const loadHooks = async () => {
    try {
      const response = await fetch('/api/v1/hooks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableHooks(data.hooks || []);
      }
    } catch (error) {
      console.error('Failed to load hooks:', error);
    }
  };

  const addStep = (hookId = null) => {
    const newStep = {
      id: Date.now().toString(),
      type: hookId ? 'hook' : 'command',
      hookId: hookId,
      name: '',
      command: '',
      condition: 'always',
      timeout: 30000,
      retries: 0,
      continueOnError: false
    };

    setWorkflow(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));

    setEditingStep(newStep.id);
    setShowStepEditor(true);
  };

  const removeStep = (stepId) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== stepId)
    }));
  };

  const updateStep = (stepId, updates) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      )
    }));
  };

  const moveStep = (stepId, direction) => {
    setWorkflow(prev => {
      const steps = [...prev.steps];
      const index = steps.findIndex(step => step.id === stepId);
      
      if (direction === 'up' && index > 0) {
        [steps[index], steps[index - 1]] = [steps[index - 1], steps[index]];
      } else if (direction === 'down' && index < steps.length - 1) {
        [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
      }
      
      return { ...prev, steps };
    });
  };

  const duplicateStep = (stepId) => {
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return;

    const duplicatedStep = {
      ...step,
      id: Date.now().toString(),
      name: `${step.name} (Copy)`
    };

    setWorkflow(prev => ({
      ...prev,
      steps: [...prev.steps, duplicatedStep]
    }));
  };

  const handleDragStart = (e, stepId) => {
    setDraggedStep(stepId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetStepId) => {
    e.preventDefault();
    
    if (!draggedStep || draggedStep === targetStepId) return;

    setWorkflow(prev => {
      const steps = [...prev.steps];
      const draggedIndex = steps.findIndex(step => step.id === draggedStep);
      const targetIndex = steps.findIndex(step => step.id === targetStepId);
      
      const [draggedItem] = steps.splice(draggedIndex, 1);
      steps.splice(targetIndex, 0, draggedItem);
      
      return { ...prev, steps };
    });

    setDraggedStep(null);
  };

  const testWorkflow = async () => {
    try {
      const response = await fetch('/api/v1/workflows/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(workflow)
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Workflow test ${result.success ? 'passed' : 'failed'}: ${result.message}`);
      } else {
        throw new Error('Test failed');
      }
    } catch (error) {
      alert(`Workflow test failed: ${error.message}`);
    }
  };

  const saveWorkflow = async () => {
    if (!workflow.name.trim()) {
      alert('Workflow name is required');
      return;
    }

    if (workflow.steps.length === 0) {
      alert('Workflow must have at least one step');
      return;
    }

    try {
      await onSave(workflow);
    } catch (error) {
      alert(`Failed to save workflow: ${error.message}`);
    }
  };

  const toggleExpandStep = (stepId) => {
    setExpanded(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const getStepIcon = (step) => {
    if (step.type === 'hook') {
      return <Zap className="w-4 h-4" />;
    }
    return <Settings className="w-4 h-4" />;
  };

  const getStepStatus = (step) => {
    // This would be populated from actual execution results
    return 'ready'; // ready, running, success, error
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialWorkflow ? 'Edit Workflow' : 'Create Workflow'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Build automation workflows by chaining hooks and commands
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={testWorkflow}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>Test</span>
          </button>
          <button
            onClick={saveWorkflow}
            className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Workflow Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Workflow Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                placeholder="My Automation Workflow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trigger Event
              </label>
              <select
                value={workflow.trigger.event}
                onChange={(e) => setWorkflow(prev => ({
                  ...prev,
                  trigger: { ...prev.trigger, event: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              >
                <option value="PreToolUse">Before Tool Use</option>
                <option value="PostToolUse">After Tool Use</option>
                <option value="FileChange">File Change</option>
                <option value="GitCommit">Git Commit</option>
                <option value="SessionStart">Session Start</option>
                <option value="SessionEnd">Session End</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={workflow.description}
              onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              rows={2}
              placeholder="Describe what this workflow does"
            />
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={workflow.settings.parallel}
                onChange={(e) => setWorkflow(prev => ({
                  ...prev,
                  settings: { ...prev.settings, parallel: e.target.checked }
                }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Run steps in parallel</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={workflow.settings.stopOnError}
                onChange={(e) => setWorkflow(prev => ({
                  ...prev,
                  settings: { ...prev.settings, stopOnError: e.target.checked }
                }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Stop on first error</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={workflow.enabled}
                onChange={(e) => setWorkflow(prev => ({ ...prev, enabled: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable workflow</span>
            </label>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 dark:text-white">Workflow Steps</h3>
            <div className="flex items-center space-x-2">
              <select
                onChange={(e) => {
                  if (e.target.value === 'new') {
                    addStep();
                  } else if (e.target.value === 'existing') {
                    // Show hook selector
                    setShowStepEditor(true);
                  }
                  e.target.value = '';
                }}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
              >
                <option value="">Add Step...</option>
                <option value="new">New Command</option>
                <option value="existing">Existing Hook</option>
              </select>
              <button
                onClick={() => addStep()}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Step</span>
              </button>
            </div>
          </div>

          {workflow.steps.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Settings className="w-12 h-12 mx-auto mb-4" />
              <h4 className="text-lg font-medium mb-2">No steps configured</h4>
              <p className="text-sm mb-4">Add steps to define your workflow automation</p>
              <button
                onClick={() => addStep()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add First Step
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {workflow.steps.map((step, index) => (
                <div key={step.id} className="relative">
                  {/* Connection Line */}
                  {index > 0 && (
                    <div className="absolute -top-2 left-6 w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                  )}
                  
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, step.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, step.id)}
                    className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-700 cursor-move ${
                      draggedStep === step.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleExpandStep(step.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          >
                            {expanded[step.id] ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                          </button>
                          <div className="flex items-center space-x-2">
                            {getStepIcon(step)}
                            {getStatusIcon(getStepStatus(step))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {step.name || `Step ${index + 1}`}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {step.type === 'hook' ? 'Hook' : 'Command'} • {step.timeout}ms timeout
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingStep(step.id);
                            setShowStepEditor(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit step"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => duplicateStep(step.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Duplicate step"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveStep(step.id, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                          title="Move up"
                        >
                          <ArrowDown className="w-4 h-4 transform rotate-180" />
                        </button>
                        <button
                          onClick={() => moveStep(step.id, 'down')}
                          disabled={index === workflow.steps.length - 1}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeStep(step.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove step"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {expanded[step.id] && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Command:</span>
                            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                              {step.command || 'No command specified'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Condition:</span>
                            <p className="mt-1 text-gray-900 dark:text-white">{step.condition}</p>
                            
                            <span className="text-gray-600 dark:text-gray-400 mt-2 block">Settings:</span>
                            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                              <li>Retries: {step.retries}</li>
                              <li>Continue on error: {step.continueOnError ? 'Yes' : 'No'}</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step connector */}
                  {index < workflow.steps.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Step Editor Modal */}
      {showStepEditor && (
        <StepEditorModal
          step={editingStep ? workflow.steps.find(s => s.id === editingStep) : null}
          availableHooks={availableHooks}
          onSave={(stepData) => {
            if (editingStep) {
              updateStep(editingStep, stepData);
            } else {
              const newStep = {
                id: Date.now().toString(),
                ...stepData
              };
              setWorkflow(prev => ({
                ...prev,
                steps: [...prev.steps, newStep]
              }));
            }
            setShowStepEditor(false);
            setEditingStep(null);
          }}
          onCancel={() => {
            setShowStepEditor(false);
            setEditingStep(null);
          }}
        />
      )}
    </div>
  );
}

function StepEditorModal({ step, availableHooks, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    type: step?.type || 'command',
    hookId: step?.hookId || '',
    name: step?.name || '',
    command: step?.command || '',
    condition: step?.condition || 'always',
    timeout: step?.timeout || 30000,
    retries: step?.retries || 0,
    continueOnError: step?.continueOnError || false
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Step name is required');
      return;
    }

    if (formData.type === 'command' && !formData.command.trim()) {
      alert('Command is required');
      return;
    }

    if (formData.type === 'hook' && !formData.hookId) {
      alert('Please select a hook');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {step ? 'Edit Step' : 'Add Step'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Step Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="command">Custom Command</option>
              <option value="hook">Existing Hook</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Step Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              placeholder="e.g., Run Tests"
            />
          </div>

          {formData.type === 'hook' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Hook *
              </label>
              <select
                value={formData.hookId}
                onChange={(e) => setFormData({ ...formData, hookId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              >
                <option value="">Choose a hook...</option>
                {availableHooks.map((hook) => (
                  <option key={hook.id} value={hook.id}>
                    {hook.name} ({hook.event})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Command *
              </label>
              <textarea
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono text-sm"
                rows={3}
                placeholder="npm test"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                value={formData.timeout}
                onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                min="1000"
                max="300000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Retries
              </label>
              <input
                type="number"
                value={formData.retries}
                onChange={(e) => setFormData({ ...formData, retries: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                min="0"
                max="5"
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="continueOnError"
              checked={formData.continueOnError}
              onChange={(e) => setFormData({ ...formData, continueOnError: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="continueOnError" className="text-sm text-gray-700 dark:text-gray-300">
              Continue workflow if this step fails
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Step
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkflowBuilder;