import React, { useState, useEffect } from 'react';
import { 
  Settings, Plus, Play, Pause, Trash2, Edit3, Save, X, 
  Clock, Zap, AlertTriangle, CheckCircle, Circle, 
  ChevronDown, ChevronRight, Code, Calendar, Filter, Workflow
} from 'lucide-react';
import WorkflowBuilder from './WorkflowBuilder';

function HookConfiguration() {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedHook, setSelectedHook] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set(['active']));
  const [filters, setFilters] = useState({
    event: 'all',
    status: 'all',
    search: ''
  });

  // Hook events and their descriptions
  const HOOK_EVENTS = {
    'PreToolUse': 'Before any tool is executed',
    'PostToolUse': 'After tool execution completes',
    'PreChatMessage': 'Before sending message to Claude',
    'PostChatMessage': 'After receiving Claude response',
    'FileChange': 'When project files are modified',
    'GitCommit': 'Before/after git commits',
    'ProjectLoad': 'When project is loaded',
    'SessionStart': 'When new chat session starts',
    'SessionEnd': 'When chat session ends',
    'Error': 'When errors occur in the system'
  };

  const HOOK_CONDITIONS = [
    { value: 'always', label: 'Always execute' },
    { value: 'file_type', label: 'File type matches', params: ['extension'] },
    { value: 'tool_name', label: 'Tool name equals', params: ['tool'] },
    { value: 'project_path', label: 'Project path contains', params: ['path'] },
    { value: 'time_range', label: 'Time range', params: ['start_time', 'end_time'] },
    { value: 'custom', label: 'Custom JavaScript condition', params: ['code'] }
  ];

  useEffect(() => {
    loadHooks();
  }, []);

  const loadHooks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/hooks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load hooks');
      }

      const data = await response.json();
      setHooks(data.hooks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleHookStatus = async (hookId, enabled) => {
    try {
      const response = await fetch(`/api/v1/hooks/${hookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        throw new Error('Failed to update hook status');
      }

      await loadHooks();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteHook = async (hookId) => {
    if (!confirm('Are you sure you want to delete this hook?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/hooks/${hookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete hook');
      }

      await loadHooks();
      if (selectedHook?.id === hookId) {
        setSelectedHook(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const testHook = async (hookId) => {
    try {
      const response = await fetch(`/api/v1/hooks/${hookId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to test hook');
      }

      const result = await response.json();
      alert(`Hook test ${result.success ? 'passed' : 'failed'}: ${result.message}`);
    } catch (err) {
      alert(`Hook test failed: ${err.message}`);
    }
  };

  const toggleCategory = (category) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getHookStatusIcon = (hook) => {
    if (!hook.enabled) return <Circle className="w-4 h-4 text-gray-400" />;
    if (hook.status === 'error') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getHookStatusColor = (hook) => {
    if (!hook.enabled) return 'text-gray-500';
    if (hook.status === 'error') return 'text-red-600';
    return 'text-green-600';
  };

  const filterHooks = (hooks) => {
    return hooks.filter(hook => {
      if (filters.event !== 'all' && hook.event !== filters.event) return false;
      if (filters.status !== 'all') {
        const status = hook.enabled ? (hook.status === 'error' ? 'error' : 'active') : 'disabled';
        if (status !== filters.status) return false;
      }
      if (filters.search && !hook.name.toLowerCase().includes(filters.search.toLowerCase()) &&
          !hook.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      return true;
    });
  };

  const categorizeHooks = (hooks) => {
    const filtered = filterHooks(hooks);
    return {
      active: filtered.filter(h => h.enabled && h.status !== 'error'),
      error: filtered.filter(h => h.enabled && h.status === 'error'),
      disabled: filtered.filter(h => !h.enabled)
    };
  };

  const categorizedHooks = categorizeHooks(hooks);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading hooks...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <Settings className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hook Configuration</h2>
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
            {hooks.length} hooks
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowWorkflowBuilder(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Workflow className="w-4 h-4" />
            <span className="hidden sm:inline">Create Workflow</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Hook</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filters.event}
              onChange={(e) => setFilters({...filters, event: e.target.value})}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="all">All Events</option>
              {Object.entries(HOOK_EVENTS).map(([value, label]) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search hooks..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-800 dark:text-red-200">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hook Categories */}
      <div className="flex-1 overflow-auto">
        {Object.entries(categorizedHooks).map(([category, categoryHooks]) => {
          if (categoryHooks.length === 0) return null;
          
          const isExpanded = expandedCategories.has(category);
          const categoryInfo = {
            active: { name: 'Active Hooks', color: 'text-green-600', icon: CheckCircle },
            error: { name: 'Error Hooks', color: 'text-red-600', icon: AlertTriangle },
            disabled: { name: 'Disabled Hooks', color: 'text-gray-500', icon: Circle }
          };

          const { name, color, icon: Icon } = categoryInfo[category];

          return (
            <div key={category} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="font-medium text-gray-900 dark:text-white">{name}</span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                    {categoryHooks.length}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="pb-2">
                  {categoryHooks.map((hook) => (
                    <div
                      key={hook.id}
                      className={`mx-4 mb-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-colors ${
                        selectedHook?.id === hook.id 
                          ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-700' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setSelectedHook(hook)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            {getHookStatusIcon(hook)}
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {hook.name}
                            </h3>
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                              {hook.event}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            {hook.description}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>Last run: {hook.last_execution ? new Date(hook.last_execution).toLocaleDateString() : 'Never'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Zap className="w-3 h-3" />
                              <span>{hook.execution_count || 0} executions</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              testHook(hook.id);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Test hook"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHookStatus(hook.id, !hook.enabled);
                            }}
                            className={`p-1 transition-colors ${
                              hook.enabled 
                                ? 'text-green-600 hover:text-red-600' 
                                : 'text-gray-400 hover:text-green-600'
                            }`}
                            title={hook.enabled ? 'Disable hook' : 'Enable hook'}
                          >
                            {hook.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHook(hook.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete hook"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {hooks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Settings className="w-12 h-12 mb-4" />
            <h3 className="text-lg font-medium mb-2">No hooks configured</h3>
            <p className="text-sm text-center mb-4">
              Create your first hook to automate workflows and respond to events.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create First Hook
            </button>
          </div>
        )}

        {hooks.length > 0 && filterHooks(hooks).length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Filter className="w-12 h-12 mb-4" />
            <h3 className="text-lg font-medium mb-2">No hooks match your filters</h3>
            <p className="text-sm text-center">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* Hook Details Panel */}
      {selectedHook && (
        <HookDetailsPanel 
          hook={selectedHook} 
          onClose={() => setSelectedHook(null)}
          onUpdate={loadHooks}
        />
      )}

      {/* Create Hook Modal */}
      {showCreateModal && (
        <CreateHookModal
          onClose={() => setShowCreateModal(false)}
          onCreate={loadHooks}
          events={HOOK_EVENTS}
          conditions={HOOK_CONDITIONS}
        />
      )}

      {/* Workflow Builder Modal */}
      {showWorkflowBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full h-full max-w-none m-0 overflow-hidden">
            <WorkflowBuilder
              onSave={async (workflowData) => {
                try {
                  const response = await fetch('/api/v1/workflows', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                      ...workflowData,
                      project_path: window.location.pathname.includes('/project/') 
                        ? decodeURIComponent(window.location.pathname.split('/project/')[1]) 
                        : null
                    })
                  });

                  if (!response.ok) {
                    throw new Error('Failed to create workflow');
                  }

                  setShowWorkflowBuilder(false);
                  // Optionally reload hooks or show success message
                  alert('Workflow created successfully!');
                } catch (error) {
                  throw new Error(`Failed to create workflow: ${error.message}`);
                }
              }}
              onCancel={() => setShowWorkflowBuilder(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function HookDetailsPanel({ hook, onClose, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(hook);
  const [saving, setSaving] = useState(false);

  const saveChanges = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/v1/hooks/${hook.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(editData)
      });

      if (!response.ok) {
        throw new Error('Failed to update hook');
      }

      await onUpdate();
      setEditing(false);
    } catch (err) {
      alert(`Failed to save changes: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium text-gray-900 dark:text-white">Hook Details</h3>
        <div className="flex items-center space-x-2">
          {editing ? (
            <>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditData(hook);
                }}
                className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            {editing ? (
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({...editData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{hook.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            {editing ? (
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({...editData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                rows={3}
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{hook.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Event
            </label>
            <p className="text-gray-900 dark:text-white">{hook.event}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Command
            </label>
            {editing ? (
              <textarea
                value={editData.command}
                onChange={(e) => setEditData({...editData, command: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono text-sm"
                rows={4}
              />
            ) : (
              <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto">
                {hook.command}
              </pre>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Condition
            </label>
            <p className="text-gray-900 dark:text-white">{hook.condition || 'Always execute'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timeout
            </label>
            {editing ? (
              <input
                type="number"
                value={editData.timeout}
                onChange={(e) => setEditData({...editData, timeout: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{hook.timeout}ms</p>
            )}
          </div>

          <div className="pt-4 space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white">Statistics</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="block">Executions</span>
                <span className="font-medium text-gray-900 dark:text-white">{hook.execution_count || 0}</span>
              </div>
              <div>
                <span className="block">Success Rate</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {hook.success_count && hook.execution_count 
                    ? Math.round((hook.success_count / hook.execution_count) * 100)
                    : 0}%
                </span>
              </div>
              <div>
                <span className="block">Last Run</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {hook.last_execution ? new Date(hook.last_execution).toLocaleDateString() : 'Never'}
                </span>
              </div>
              <div>
                <span className="block">Avg Duration</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {hook.avg_duration ? Math.round(hook.avg_duration) : 0}ms
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateHookModal({ onClose, onCreate, events, conditions }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    event: 'PreToolUse',
    condition: 'always',
    conditionParams: {},
    command: '',
    timeout: 30000,
    enabled: true
  });
  const [creating, setCreating] = useState(false);

  const handleConditionChange = (condition) => {
    setFormData({
      ...formData,
      condition,
      conditionParams: {}
    });
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      const response = await fetch('/api/v1/hooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to create hook');
      }

      await onCreate();
      onClose();
    } catch (err) {
      alert(`Failed to create hook: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const selectedCondition = conditions.find(c => c.value === formData.condition);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Hook</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hook Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              placeholder="e.g., Pre-commit linting"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              rows={2}
              placeholder="Brief description of what this hook does"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Event *
            </label>
            <select
              value={formData.event}
              onChange={(e) => setFormData({...formData, event: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              {Object.entries(events).map(([value, label]) => (
                <option key={value} value={value}>{value} - {label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Condition
            </label>
            <select
              value={formData.condition}
              onChange={(e) => handleConditionChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              {conditions.map((condition) => (
                <option key={condition.value} value={condition.value}>{condition.label}</option>
              ))}
            </select>
          </div>

          {/* Condition Parameters */}
          {selectedCondition?.params && (
            <div className="space-y-2">
              {selectedCondition.params.map((param) => (
                <div key={param}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {param.replace('_', ' ').toUpperCase()}
                  </label>
                  <input
                    type="text"
                    value={formData.conditionParams[param] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditionParams: {
                        ...formData.conditionParams,
                        [param]: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                    placeholder={`Enter ${param}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Command *
            </label>
            <textarea
              value={formData.command}
              onChange={(e) => setFormData({...formData, command: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono text-sm"
              rows={4}
              placeholder="npm run lint && npm run test"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timeout (ms)
            </label>
            <input
              type="number"
              value={formData.timeout}
              onChange={(e) => setFormData({...formData, timeout: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              min="1000"
              max="300000"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
              className="mr-2"
            />
            <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
              Enable hook immediately
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !formData.name || !formData.command}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {creating && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            <span>Create Hook</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default HookConfiguration;