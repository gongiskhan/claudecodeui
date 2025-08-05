import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

const CommandBrowser = ({ projectPath, onExecuteCommand, onCreateCommand }) => {
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScope, setSelectedScope] = useState('all');
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);

  useEffect(() => {
    fetchCommands();
  }, [projectPath, selectedScope]);

  const fetchCommands = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        type: 'command',
        ...(selectedScope !== 'all' && { classification: selectedScope }),
        ...(projectPath && { project_path: projectPath })
      });

      const response = await fetch(`/api/v1/extensions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCommands(data.extensions || []);
      } else {
        console.error('Failed to fetch commands');
      }
    } catch (error) {
      console.error('Error fetching commands:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCommands = commands.filter(command =>
    command.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    command.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (command.tags && command.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const getScopeColor = (classification) => {
    switch (classification) {
      case 'user': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'default': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'selectable': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const handleExecuteCommand = (command) => {
    setSelectedCommand(command);
    setShowExecuteModal(true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Commands
          </h2>
          <Button
            onClick={() => setShowCreateWizard(true)}
            className="text-sm"
          >
            + Create Command
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <Input
            placeholder="Search commands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          
          <div className="flex gap-2">
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Scopes</option>
              <option value="user">User Commands</option>
              <option value="default">Default Commands</option>
              <option value="selectable">Project Commands</option>
            </select>
          </div>
        </div>
      </div>

      {/* Command List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading commands...
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No commands match your search.' : 'No commands available.'}
              <div className="mt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateWizard(true)}
                  className="text-sm"
                >
                  Create your first command
                </Button>
              </div>
            </div>
          ) : (
            filteredCommands.map((command) => (
              <CommandCard
                key={command.id}
                command={command}
                onExecute={handleExecuteCommand}
                onViewDetails={setSelectedCommand}
                getScopeColor={getScopeColor}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Command Details Modal */}
      {selectedCommand && !showExecuteModal && (
        <CommandDetailsModal
          command={selectedCommand}
          onClose={() => setSelectedCommand(null)}
          onExecute={handleExecuteCommand}
          getScopeColor={getScopeColor}
        />
      )}

      {/* Command Execution Modal */}
      {showExecuteModal && selectedCommand && (
        <CommandExecutionModal
          command={selectedCommand}
          onClose={() => {
            setShowExecuteModal(false);
            setSelectedCommand(null);
          }}
          onExecute={(commandData) => {
            if (onExecuteCommand) onExecuteCommand(commandData);
            setShowExecuteModal(false);
            setSelectedCommand(null);
          }}
          projectPath={projectPath}
        />
      )}

      {/* Create Command Wizard */}
      {showCreateWizard && (
        <CommandCreateWizard
          onClose={() => setShowCreateWizard(false)}
          onCreate={(commandData) => {
            if (onCreateCommand) onCreateCommand(commandData);
            setShowCreateWizard(false);
            fetchCommands();
          }}
          projectPath={projectPath}
        />
      )}
    </div>
  );
};

const CommandCard = ({ command, onExecute, onViewDetails, getScopeColor }) => {
  const parseParameters = (template) => {
    const parameterPattern = /\$([A-Z_]+)/g;
    const parameters = [];
    let match;

    while ((match = parameterPattern.exec(template)) !== null) {
      const paramName = match[1];
      if (!parameters.find(p => p.name === paramName)) {
        parameters.push({ name: paramName });
      }
    }
    return parameters;
  };

  const template = command.config ? JSON.parse(command.config).template || '' : '';
  const parameters = parseParameters(template);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Command Header */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {command.name}
            </h3>
            <Badge className={getScopeColor(command.classification)}>
              {command.classification}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {command.description}
          </p>

          {/* Command Preview */}
          {template && (
            <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300 line-clamp-2">
              {template.length > 100 ? template.substring(0, 100) + '...' : template}
            </div>
          )}

          {/* Parameters */}
          {parameters.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Parameters ({parameters.length}):
              </div>
              <div className="flex flex-wrap gap-1">
                {parameters.slice(0, 3).map((param, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                  >
                    ${param.name}
                  </span>
                ))}
                {parameters.length > 3 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    +{parameters.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {command.tags && command.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {command.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Command Info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            {command.version && <span>v{command.version}</span>}
            {command.author && <span>by {command.author}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 ml-4">
          <Button
            variant="default"
            size="sm"
            onClick={() => onExecute(command)}
          >
            Execute
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(command)}
          >
            Details
          </Button>
        </div>
      </div>
    </div>
  );
};

const CommandDetailsModal = ({ command, onClose, onExecute, getScopeColor }) => {
  const config = command.config ? JSON.parse(command.config) : {};
  const template = config.template || '';
  const parameters = config.parameters || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {command.name}
              </h2>
              <div className="flex gap-2 mb-3">
                <Badge className={getScopeColor(command.classification)}>
                  {command.classification}
                </Badge>
                <Badge variant="outline">
                  Command
                </Badge>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-96">
          <div className="p-6 space-y-4">
            {/* Description */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Description</h3>
              <p className="text-gray-600 dark:text-gray-400">{command.description}</p>
            </div>

            {/* Template */}
            {template && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Command Template</h3>
                <pre className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">
                  {template}
                </pre>
              </div>
            )}

            {/* Parameters */}
            {parameters.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Parameters</h3>
                <div className="space-y-2">
                  {parameters.map((param, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                      <div>
                        <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                          ${param.name}
                        </span>
                        {param.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {param.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={param.required ? 'destructive' : 'secondary'}>
                          {param.required ? 'Required' : 'Optional'}
                        </Badge>
                        <Badge variant="outline">
                          {param.type || 'string'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              {command.version && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Version</h4>
                  <p className="text-gray-600 dark:text-gray-400">{command.version}</p>
                </div>
              )}
              {command.author && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Author</h4>
                  <p className="text-gray-600 dark:text-gray-400">{command.author}</p>
                </div>
              )}
              {command.source && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Source</h4>
                  <p className="text-gray-600 dark:text-gray-400">{command.source}</p>
                </div>
              )}
            </div>

            {/* Tags */}
            {command.tags && command.tags.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {command.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onExecute(command)}>
            Execute Command
          </Button>
        </div>
      </div>
    </div>
  );
};

const CommandExecutionModal = ({ command, onClose, onExecute, projectPath }) => {
  const [parameters, setParameters] = useState({});
  const [preview, setPreview] = useState('');
  const [executing, setExecuting] = useState(false);

  const config = command.config ? JSON.parse(command.config) : {};
  const template = config.template || '';
  const parameterDefs = config.parameters || [];

  // Extract parameters from template if not defined in config
  const extractedParams = [];
  const parameterPattern = /\$([A-Z_]+)/g;
  let match;
  while ((match = parameterPattern.exec(template)) !== null) {
    const paramName = match[1];
    if (!extractedParams.find(p => p.name === paramName)) {
      extractedParams.push({
        name: paramName,
        type: 'string',
        required: true,
        description: `Parameter ${paramName}`
      });
    }
  }

  const allParameters = parameterDefs.length > 0 ? parameterDefs : extractedParams;

  useEffect(() => {
    // Generate preview
    let previewText = template;
    Object.entries(parameters).forEach(([key, value]) => {
      if (value) {
        previewText = previewText.replace(new RegExp(`\\$${key}`, 'g'), value);
      }
    });
    setPreview(previewText);
  }, [parameters, template]);

  const handleParameterChange = (paramName, value) => {
    setParameters(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleExecute = async () => {
    // Validate required parameters
    const missingParams = allParameters
      .filter(param => param.required && !parameters[param.name])
      .map(param => param.name);

    if (missingParams.length > 0) {
      alert(`Missing required parameters: ${missingParams.join(', ')}`);
      return;
    }

    setExecuting(true);
    const startTime = Date.now();
    
    try {
      // Execute the command by passing the generated text to the parent
      const executionData = {
        command: command,
        parameters: parameters,
        generatedText: preview,
        projectPath: projectPath
      };

      // Log the execution
      const token = localStorage.getItem('token');
      const executionTime = Date.now() - startTime;
      
      try {
        await fetch(`/api/v1/extensions/${command.id}/execute`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            project_path: projectPath,
            parameters: parameters,
            execution_time: executionTime,
            status: 'success',
            generated_text: preview
          })
        });
      } catch (logError) {
        console.warn('Failed to log command execution:', logError);
        // Don't fail the command execution if logging fails
      }

      onExecute(executionData);
    } catch (error) {
      console.error('Command execution error:', error);
      
      // Log the error
      const token = localStorage.getItem('token');
      const executionTime = Date.now() - startTime;
      
      try {
        await fetch(`/api/v1/extensions/${command.id}/execute`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            project_path: projectPath,
            parameters: parameters,
            execution_time: executionTime,
            status: 'error',
            error_message: error.message,
            generated_text: preview
          })
        });
      } catch (logError) {
        console.warn('Failed to log command execution error:', logError);
      }
      
      alert('Failed to execute command. Please try again.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Execute: {command.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex h-[70vh]">
          {/* Parameters Panel */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                Parameters
              </h3>
              
              {allParameters.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  This command has no parameters.
                </p>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-4">
                    {allParameters.map((param, index) => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          ${param.name} {param.required && <span className="text-red-500">*</span>}
                        </label>
                        {param.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {param.description}
                          </p>
                        )}
                        {param.type === 'file' || param.type === 'directory' ? (
                          <input
                            type="text"
                            placeholder={param.type === 'file' ? 'File path...' : 'Directory path...'}
                            value={parameters[param.name] || ''}
                            onChange={(e) => handleParameterChange(param.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        ) : param.type === 'boolean' ? (
                          <select
                            value={parameters[param.name] || 'false'}
                            onChange={(e) => handleParameterChange(param.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            <option value="false">False</option>
                            <option value="true">True</option>
                          </select>
                        ) : (
                          <textarea
                            placeholder={`Enter ${param.name.toLowerCase()}...`}
                            value={parameters[param.name] || ''}
                            onChange={(e) => handleParameterChange(param.name, e.target.value)}
                            rows={param.type === 'string' ? 2 : 4}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="w-1/2">
            <div className="p-6">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                Command Preview
              </h3>
              <div className="h-full">
                <ScrollArea className="h-96">
                  <pre className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {preview || template}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleExecute}
            disabled={executing}
          >
            {executing ? 'Executing...' : 'Execute Command'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const CommandCreateWizard = ({ onClose, onCreate, projectPath }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    classification: 'selectable',
    template: '',
    version: '1.0.0',
    author: '',
    tags: []
  });
  const [parameters, setParameters] = useState([]);
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (step === 1) {
      fetchTemplates();
    }
  }, [step]);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/extensions/templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const detectParameters = (template) => {
    const parameterPattern = /\$([A-Z_]+)/g;
    const detected = [];
    let match;

    while ((match = parameterPattern.exec(template)) !== null) {
      const paramName = match[1];
      if (!detected.find(p => p.name === paramName)) {
        detected.push({
          name: paramName,
          type: 'string',
          required: true,
          description: `Parameter ${paramName}`
        });
      }
    }
    return detected;
  };

  const handleTemplateChange = (template) => {
    setFormData(prev => ({ ...prev, template }));
    const detectedParams = detectParameters(template);
    setParameters(detectedParams);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      template: template.template,
      tags: template.tags || []
    }));
    setParameters(template.parameters || detectParameters(template.template));
    setStep(2);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.template) {
      alert('Please fill in required fields');
      return;
    }

    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      
      const commandData = {
        name: formData.name,
        description: formData.description,
        version: formData.version,
        type: 'command',
        classification: formData.classification,
        source: 'local',
        author: formData.author,
        config: JSON.stringify({
          template: formData.template,
          parameters: parameters,
          tags: formData.tags
        })
      };

      const response = await fetch('/api/v1/extensions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commandData)
      });

      if (response.ok) {
        const result = await response.json();
        onCreate(result);
      } else {
        const error = await response.json();
        alert(`Creation failed: ${error.details || error.error}`);
      }
    } catch (error) {
      console.error('Command creation error:', error);
      alert('Creation failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Create New Command
          </h2>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-4">
            {step === 1 && (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Choose a Starting Point
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {/* Custom Template Option */}
                    <div 
                      onClick={() => setStep(2)}
                      className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          Create from Scratch
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Start with a blank template and build your own command
                        </p>
                      </div>
                    </div>

                    {/* Template Library */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        Or choose from a template:
                      </h4>
                      
                      {loadingTemplates ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                          Loading templates...
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {templates.map((template, index) => (
                            <div
                              key={index}
                              onClick={() => handleTemplateSelect(template)}
                              className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900 dark:text-gray-100">
                                    {template.name}
                                  </h5>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    {template.description}
                                  </p>
                                  {template.category && (
                                    <Badge className="mt-2 text-xs" variant="outline">
                                      {template.category}
                                    </Badge>
                                  )}
                                </div>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Command Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., Analyze Component"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="What does this command do?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Command Template *
                  </label>
                  <textarea
                    value={formData.template}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                    placeholder="Enter your command template here. Use $PARAMETER_NAME for parameters."
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use $PARAMETER_NAME format for parameters (e.g., $FILE_PATH, $COMPONENT_NAME)
                  </p>
                </div>

                {parameters.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Detected Parameters
                    </label>
                    <div className="space-y-2">
                      {parameters.map((param, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                            ${param.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({param.type})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => setStep(3)}
                    disabled={!formData.name || !formData.template}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Classification
                  </label>
                  <select
                    value={formData.classification}
                    onChange={(e) => setFormData(prev => ({ ...prev, classification: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="selectable">Selectable - Manual selection per project</option>
                    <option value="default">Default - Auto-enabled for new projects</option>
                    <option value="user">User - Enabled across all projects</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Version
                    </label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Author
                    </label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags.join(', ')}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="react, analysis, performance"
                  />
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreate}
                      disabled={creating}
                    >
                      {creating ? 'Creating...' : 'Create Command'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default CommandBrowser;