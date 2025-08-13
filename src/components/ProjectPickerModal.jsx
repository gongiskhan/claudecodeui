import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Folder, ArrowUp, X, FolderPlus, Home, RefreshCw, Github } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../utils/api';
import GitHubRepoSelector from './GitHubRepoSelector';

function ProjectPickerModal({ isOpen, onClose, onSelectProject }) {
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState(null);
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPath, setSelectedPath] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);
  const [manualPath, setManualPath] = useState('');
  const [showGitHubSelector, setShowGitHubSelector] = useState(false);
  const [isGitHubAuthenticated, setIsGitHubAuthenticated] = useState(false);

  // Detect OS and get appropriate home directory path
  const getDefaultPath = () => {
    // Use tilde expansion which will be resolved by the server to the actual home directory
    return '~';
  };

  // Load directories when modal opens or path changes
  useEffect(() => {
    if (isOpen) {
      if (initialLoad) {

        // Start with ~/dev which will be resolved by the server
        // const projectParent = '~/dev';

        // Start at OS-specific users directory
        const projectParent = getDefaultPath();

        setCurrentPath(projectParent);
        loadDirectories(projectParent);
        setInitialLoad(false);
        
        // Check GitHub authentication status
        checkGitHubAuth();
      }
    }
  }, [isOpen]);

  // Separate effect for currentPath changes (excluding initial load)
  useEffect(() => {
    if (isOpen && !initialLoad && currentPath) {
      loadDirectories(currentPath);
    }
  }, [currentPath]);

  const checkGitHubAuth = async () => {
    try {
      const response = await api.fetchWithAuth('/api/auth/github/status');
      if (response.ok) {
        const data = await response.json();
        setIsGitHubAuthenticated(data.isGitHubAuthenticated);
      }
    } catch (error) {
      console.error('Error checking GitHub auth:', error);
    }
  };

  const loadDirectories = async (path = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.listDirectories(path);
      if (response.ok) {
        const data = await response.json();
        setCurrentPath(data.currentPath);
        setParentPath(data.parentPath);
        setDirectories(data.directories);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load directories');
      }
    } catch (error) {
      console.error('Error loading directories:', error);
      setError('Failed to load directories');
    } finally {
      setLoading(false);
    }
  };

  const navigateToPath = (path) => {
    setCurrentPath(path);
    setSelectedPath('');
    loadDirectories(path);
  };

  const goToParent = () => {
    if (parentPath) {
      navigateToPath(parentPath);
    }
  };

  const goToHome = () => {

    // navigateToPath('~/dev');

    // Navigate to OS-specific users directory
    navigateToPath(getDefaultPath());

  };

  const selectDirectory = (directory) => {
    setSelectedPath(directory.path);
  };

  const navigateToDirectory = (directory) => {
    navigateToPath(directory.path);
  };

  const handleSelectProject = () => {
    if (selectedPath) {
      onSelectProject(selectedPath);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedPath('');
    setError(null);
    setInitialLoad(true);
    setShowGitHubSelector(false);
    onClose();
  };

  const handleGitHubRepoSelect = (repoPath) => {
    // The repository has been cloned, now add it as a project
    onSelectProject(repoPath);
    handleClose();
  };

  if (!isOpen) return null;

  // Show GitHub repository selector if selected
  if (showGitHubSelector) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card rounded-lg border border-border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
          <GitHubRepoSelector 
            onSelectRepo={handleGitHubRepoSelect}
            onBack={() => setShowGitHubSelector(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-lg border border-border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <FolderPlus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Select Project Directory</h2>
              <p className="text-sm text-muted-foreground">Choose an existing project directory to add</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Bar */}
        <div className="flex flex-col gap-2 p-3 border-b border-border bg-muted/30">
          {/* GitHub Clone Option */}
          {isGitHubAuthenticated && (
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGitHubSelector(true)}
                className="h-8 px-3 w-full"
              >
                <Github className="w-3 h-3 mr-2" />
                Clone from GitHub
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToHome}
              disabled={loading}
              className="h-8 px-3"
            >
              <Home className="w-3 h-3 mr-2" />
              Home
            </Button>
            {parentPath && (
              <Button
                variant="ghost"
                size="sm"
                onClick={goToParent}
                disabled={loading}
                className="h-8 px-3"
              >
                <ArrowUp className="w-3 h-3 mr-2" />
                Up
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadDirectories(currentPath)}
              disabled={loading}
              className="h-8 px-3 ml-auto"
            >
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
            </Button>
            <div className="text-xs text-muted-foreground truncate max-w-xs">
              {currentPath || getDefaultPath()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (currentPath) {
                  setSelectedPath(currentPath);
                }
              }}
              className="h-8 px-3 ml-2"
            >
              <FolderPlus className="w-3 h-3 mr-2" />
              Select This Folder
            </Button>
          </div>
          
          {/* Manual Path Entry */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualPath.trim()) {
                  navigateToPath(manualPath.trim());
                  setManualPath('');
                }
              }}
              placeholder="Enter path (e.g., ~/dev or /Users/username)"
              className="flex-1 h-8 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder-muted-foreground"
              disabled={loading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (manualPath.trim()) {
                  navigateToPath(manualPath.trim());
                  setManualPath('');
                }
              }}
              disabled={!manualPath.trim() || loading}
              className="h-8 px-3"
            >
              Go
            </Button>
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="p-4 text-center">
              <div className="text-red-600 dark:text-red-400 mb-2">{error}</div>
              <Button size="sm" onClick={() => loadDirectories(currentPath)}>
                Try Again
              </Button>
            </div>
          ) : loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading directories...</p>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
              <div className="p-2">
                {directories.length === 0 ? (
                  <div className="text-center py-8">
                    <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No directories found</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {directories.map((directory) => (
                      <div
                        key={directory.path}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border border-transparent transition-all cursor-pointer hover:bg-accent/50",
                          selectedPath === directory.path && "bg-primary/5 border-primary/20"
                        )}
                        onClick={() => selectDirectory(directory)}
                        onDoubleClick={() => navigateToDirectory(directory)}
                      >
                        <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {directory.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {directory.path}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          Double-click to open
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="flex-1 min-w-0">
            {selectedPath && (
              <div className="text-sm">
                <span className="text-muted-foreground">Selected: </span>
                <span className="font-medium text-foreground truncate">{selectedPath}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSelectProject}
              disabled={!selectedPath}
              className="bg-primary hover:bg-primary/90"
            >
              Add Project
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectPickerModal;

