import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Github, GitBranch, Lock, Globe, Star, GitFork, Search, Loader2, FolderGit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../utils/api';

function GitHubRepoSelector({ onSelectRepo, onBack }) {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [clonePath, setClonePath] = useState('');
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.fetchWithAuth('/api/github/repos');
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories);
        
        // Set default clone path - will be resolved by server
        setClonePath(`~/dev`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch repositories');
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setError('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const filteredRepos = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectRepo = (repo) => {
    setSelectedRepo(repo);
    // Update clone path with repo name
    const basePath = clonePath.endsWith('/') ? clonePath : `${clonePath}/`;
    setClonePath(`${basePath}${repo.name}`);
  };

  const handleClone = async () => {
    if (!selectedRepo || !clonePath) return;
    
    setCloning(true);
    setError(null);
    
    try {
      const response = await api.fetchWithAuth('/api/github/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl: selectedRepo.cloneUrl,
          sshUrl: selectedRepo.sshUrl,
          targetPath: clonePath,
          useSsh: false // Default to HTTPS for simplicity
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Call the parent callback with the cloned project path
        onSelectRepo(data.path);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to clone repository');
      }
    } catch (error) {
      console.error('Error cloning repository:', error);
      setError('Failed to clone repository');
    } finally {
      setCloning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
        <p className="text-sm text-muted-foreground">Loading your GitHub repositories...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
        <div className="flex gap-2 justify-center">
          <Button size="sm" onClick={fetchRepositories}>
            Try Again
          </Button>
          <Button size="sm" variant="outline" onClick={onBack}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
          <Github className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">Clone from GitHub</h3>
          <p className="text-sm text-muted-foreground">Select a repository to clone</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repositories..."
            className="w-full pl-10 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder-muted-foreground"
          />
        </div>
      </div>

      {/* Repository List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredRepos.length === 0 ? (
          <div className="text-center py-8">
            <FolderGit2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No repositories match your search' : 'No repositories found'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                className={cn(
                  "p-3 rounded-lg border border-transparent transition-all cursor-pointer hover:bg-accent/50",
                  selectedRepo?.id === repo.id && "bg-primary/5 border-primary/20"
                )}
                onClick={() => handleSelectRepo(repo)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {repo.private ? (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Globe className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground truncate">
                        {repo.name}
                      </span>
                      {repo.language && (
                        <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                          {repo.language}
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="w-3 h-3" />
                        {repo.defaultBranch}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3 h-3" />
                        {repo.stargazersCount}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GitFork className="w-3 h-3" />
                        {repo.forksCount}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clone Configuration */}
      {selectedRepo && (
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Clone to:
              </label>
              <input
                type="text"
                value={clonePath}
                onChange={(e) => setClonePath(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                placeholder="Enter target directory path"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Repository: {selectedRepo.fullName}
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 border-t border-border">
        <Button
          variant="outline"
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          onClick={handleClone}
          disabled={!selectedRepo || !clonePath || cloning}
          className="bg-primary hover:bg-primary/90"
        >
          {cloning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Cloning...
            </>
          ) : (
            <>
              <FolderGit2 className="w-4 h-4 mr-2" />
              Clone & Add Project
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default GitHubRepoSelector;