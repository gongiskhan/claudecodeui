import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

const AgentBrowser = ({ projectPath, onInstallAgent, onEnableAgent, onDisableAgent }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassification, setSelectedClassification] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showInstallWizard, setShowInstallWizard] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, [projectPath, selectedClassification]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        type: 'agent',
        ...(selectedClassification !== 'all' && { classification: selectedClassification }),
        ...(projectPath && { project_path: projectPath })
      });

      const response = await fetch(`/api/v1/extensions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data.extensions || []);
      } else {
        console.error('Failed to fetch agents');
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (agent.tags && agent.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleEnableToggle = async (agentId, enabled) => {
    if (!projectPath) return;
    
    try {
      const token = localStorage.getItem('token');
      const endpoint = enabled ? 'enable' : 'disable';
      
      const response = await fetch(`/api/v1/extensions/${agentId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ project_path: projectPath })
      });

      if (response.ok) {
        if (enabled && onEnableAgent) onEnableAgent(agentId);
        if (!enabled && onDisableAgent) onDisableAgent(agentId);
        fetchAgents(); // Refresh to show updated status
      }
    } catch (error) {
      console.error('Error toggling agent:', error);
    }
  };

  const getClassificationColor = (classification) => {
    switch (classification) {
      case 'user': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'default': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'selectable': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusColor = (status, projectEnabled) => {
    if (projectEnabled === true) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (projectEnabled === false) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (status === 'installed') return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Sub-Agents
          </h2>
          <Button
            onClick={() => setShowInstallWizard(true)}
            className="text-sm"
          >
            + Install Agent
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <Input
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          
          <div className="flex gap-2">
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Classifications</option>
              <option value="user">User</option>
              <option value="default">Default</option>
              <option value="selectable">Selectable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Agent List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading agents...
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No agents match your search.' : 'No agents available.'}
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                projectPath={projectPath}
                onEnableToggle={handleEnableToggle}
                onViewDetails={setSelectedAgent}
                getClassificationColor={getClassificationColor}
                getStatusColor={getStatusColor}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Agent Details Modal */}
      {selectedAgent && (
        <AgentDetailsModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          projectPath={projectPath}
          onEnableToggle={handleEnableToggle}
          getClassificationColor={getClassificationColor}
          getStatusColor={getStatusColor}
        />
      )}

      {/* Install Wizard Modal */}
      {showInstallWizard && (
        <AgentInstallWizard
          onClose={() => setShowInstallWizard(false)}
          onInstall={(agentData) => {
            if (onInstallAgent) onInstallAgent(agentData);
            setShowInstallWizard(false);
            fetchAgents();
          }}
        />
      )}
    </div>
  );
};

const AgentCard = ({ agent, projectPath, onEnableToggle, onViewDetails, getClassificationColor, getStatusColor }) => {
  const isProjectEnabled = agent.project_enabled;
  const canToggle = projectPath && (agent.classification === 'selectable' || agent.classification === 'default');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Agent Header */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {agent.name}
            </h3>
            <Badge className={getClassificationColor(agent.classification)}>
              {agent.classification}
            </Badge>
            {projectPath && (
              <Badge className={getStatusColor(agent.status, isProjectEnabled)}>
                {isProjectEnabled ? 'Enabled' : isProjectEnabled === false ? 'Disabled' : agent.status}
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {agent.description}
          </p>

          {/* Tags */}
          {agent.tags && agent.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {agent.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
              {agent.tags.length > 3 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{agent.tags.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Agent Info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            {agent.version && <span>v{agent.version}</span>}
            {agent.author && <span>by {agent.author}</span>}
            {agent.model && <span>Model: {agent.model}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(agent)}
          >
            Details
          </Button>
          
          {canToggle && (
            <Button
              variant={isProjectEnabled ? "destructive" : "default"}
              size="sm"
              onClick={() => onEnableToggle(agent.id, !isProjectEnabled)}
            >
              {isProjectEnabled ? 'Disable' : 'Enable'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const AgentDetailsModal = ({ agent, onClose, projectPath, onEnableToggle, getClassificationColor, getStatusColor }) => {
  const isProjectEnabled = agent.project_enabled;
  const canToggle = projectPath && (agent.classification === 'selectable' || agent.classification === 'default');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {agent.name}
              </h2>
              <div className="flex gap-2 mb-3">
                <Badge className={getClassificationColor(agent.classification)}>
                  {agent.classification}
                </Badge>
                {projectPath && (
                  <Badge className={getStatusColor(agent.status, isProjectEnabled)}>
                    {isProjectEnabled ? 'Enabled' : isProjectEnabled === false ? 'Disabled' : agent.status}
                  </Badge>
                )}
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
              <p className="text-gray-600 dark:text-gray-400">{agent.description}</p>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              {agent.version && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Version</h4>
                  <p className="text-gray-600 dark:text-gray-400">{agent.version}</p>
                </div>
              )}
              {agent.author && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Author</h4>
                  <p className="text-gray-600 dark:text-gray-400">{agent.author}</p>
                </div>
              )}
              {agent.model && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Model</h4>
                  <p className="text-gray-600 dark:text-gray-400">{agent.model}</p>
                </div>
              )}
              {agent.source && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Source</h4>
                  <p className="text-gray-600 dark:text-gray-400">{agent.source}</p>
                </div>
              )}
            </div>

            {/* Tools */}
            {agent.tools && agent.tools.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Required Tools</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.tools.map((tool, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {agent.tags && agent.tags.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.tags.map((tag, index) => (
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

            {/* Dependencies */}
            {agent.dependencies && agent.dependencies.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Dependencies</h3>
                <div className="space-y-2">
                  {agent.dependencies.map((dep, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm text-gray-900 dark:text-gray-100">{dep.dependency_id}</span>
                      <div className="flex gap-2">
                        {dep.version_constraint && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{dep.version_constraint}</span>
                        )}
                        <Badge variant={dep.required ? 'destructive' : 'secondary'}>
                          {dep.required ? 'Required' : 'Optional'}
                        </Badge>
                      </div>
                    </div>
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
          {canToggle && (
            <Button
              variant={isProjectEnabled ? "destructive" : "default"}
              onClick={() => {
                onEnableToggle(agent.id, !isProjectEnabled);
                onClose();
              }}
            >
              {isProjectEnabled ? 'Disable for Project' : 'Enable for Project'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const AgentInstallWizard = ({ onClose, onInstall }) => {
  const [step, setStep] = useState(1);
  const [installMethod, setInstallMethod] = useState('file');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    classification: 'selectable',
    source: 'local',
    file: null,
    github_url: '',
    author: '',
    version: '1.0.0'
  });
  const [installing, setInstalling] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, file }));
      // Auto-populate name from filename
      if (!formData.name) {
        const nameFromFile = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
        setFormData(prev => ({ ...prev, name: nameFromFile }));
      }
    }
  };

  const handleInstall = async () => {
    if (!formData.name || (!formData.file && !formData.github_url)) {
      alert('Please fill in required fields');
      return;
    }

    setInstalling(true);
    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('version', formData.version);
      formDataToSend.append('type', 'agent');
      formDataToSend.append('classification', formData.classification);
      formDataToSend.append('source', formData.source);
      
      if (formData.author) formDataToSend.append('author', formData.author);
      if (formData.file) formDataToSend.append('file', formData.file);
      if (formData.github_url) formDataToSend.append('source_url', formData.github_url);

      const response = await fetch('/api/v1/extensions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataToSend
      });

      if (response.ok) {
        const result = await response.json();
        onInstall(result);
      } else {
        const error = await response.json();
        alert(`Installation failed: ${error.details || error.error}`);
      }
    } catch (error) {
      console.error('Installation error:', error);
      alert('Installation failed. Please try again.');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Install Sub-Agent
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Installation Method
                </label>
                <select
                  value={installMethod}
                  onChange={(e) => {
                    setInstallMethod(e.target.value);
                    setFormData(prev => ({ 
                      ...prev, 
                      source: e.target.value === 'github' ? 'github' : 'local' 
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="file">Upload File</option>
                  <option value="github">GitHub Repository</option>
                </select>
              </div>

              {installMethod === 'file' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Agent File (.md)
                  </label>
                  <input
                    type="file"
                    accept=".md,.markdown"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/user/repo"
                    value={formData.github_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, github_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => setStep(2)}
                  disabled={!formData.file && !formData.github_url}
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
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                />
              </div>

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

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleInstall}
                    disabled={installing || !formData.name}
                  >
                    {installing ? 'Installing...' : 'Install Agent'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentBrowser;