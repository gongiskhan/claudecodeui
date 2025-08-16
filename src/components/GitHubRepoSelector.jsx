import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Github, GitBranch, Lock, Globe, Star, GitFork, Search, Loader2, FolderGit2, Building2, User, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../utils/api';

function GitHubRepoSelector({ onSelectRepo, onBack }) {
  const [repositories, setRepositories] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [clonePath, setClonePath] = useState('');
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch both user repos and organizations in parallel
      const [reposResponse, orgsResponse] = await Promise.all([
        api.fetchWithAuth('/api/github/repos'),
        api.fetchWithAuth('/api/github/orgs')
      ]);
      
      if (reposResponse.ok) {
        const data = await reposResponse.json();
        setRepositories(data.repositories);
      }
      
      if (orgsResponse.ok) {
        const data = await orgsResponse.json();
        setOrganizations(data.organizations);
      }
      
      // Set default clone path - will be resolved by server
      setClonePath(`~/dev`);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      setError('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgRepositories = async (org) => {
    setLoadingRepos(true);
    setError(null);
    setSelectedOrg(org);
    setShowOrgDropdown(false);
    
    try {
      const response = await api.fetchWithAuth(`/api/github/repos?org=${org.login}`);
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch organization repositories');
      }
    } catch (error) {
      console.error('Error fetching organization repositories:', error);
      setError('Failed to fetch organization repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchUserRepositories = async () => {
    setLoadingRepos(true);
    setError(null);
    setSelectedOrg(null);
    setShowOrgDropdown(false);
    
    try {
      const response = await api.fetchWithAuth('/api/github/repos');
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories);
      }
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      setError('Failed to fetch repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const filteredRepos = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (repo.owner && repo.owner.login.toLowerCase().includes(searchQuery.toLowerCase()))
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

  // Group repositories by owner
  const groupedRepos = filteredRepos.reduce((acc, repo) => {
    const owner = repo.owner.login;
    if (!acc[owner]) {
      acc[owner] = {
        type: repo.owner.type,
        repos: []
      };
    }
    acc[owner].repos.push(repo);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
        <p className="text-sm text-muted-foreground">Loading your GitHub repositories...</p>
      </div>
    );
  }

  if (error && repositories.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
        <div className="flex gap-2 justify-center">
          <Button size="sm" onClick={fetchInitialData}>
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
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border flex-shrink-0">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
          <Github className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">Clone from GitHub</h3>
          <p className="text-sm text-muted-foreground">
            {repositories.length} repositories {selectedOrg ? `from ${selectedOrg.login}` : 'from your account'}
          </p>
        </div>
      </div>

      {/* Organization Selector */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md hover:bg-accent/50 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {selectedOrg ? (
                <>
                  <Building2 className="w-4 h-4" />
                  <span>{selectedOrg.name || selectedOrg.login}</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4" />
                  <span>My Repositories</span>
                </>
              )}
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform", showOrgDropdown && "rotate-180")} />
          </button>
          
          {showOrgDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
              <button
                onClick={() => fetchUserRepositories()}
                className="w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2 text-left"
              >
                <User className="w-4 h-4" />
                <span>My Repositories</span>
              </button>
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => fetchOrgRepositories(org)}
                  className="w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2 text-left"
                >
                  <Building2 className="w-4 h-4" />
                  <span>{org.name || org.login}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border flex-shrink-0">
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

      {/* Repository List - Fixed height with scroll */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {loadingRepos ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm text-muted-foreground">Loading repositories...</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-8">
            <FolderGit2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No repositories match your search' : 'No repositories found'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {Object.entries(groupedRepos).map(([owner, data]) => (
              <div key={owner}>
                {Object.keys(groupedRepos).length > 1 && (
                  <div className="sticky top-0 bg-background/95 backdrop-blur-sm px-2 py-1 mb-1 flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    {data.type === 'Organization' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {owner}
                  </div>
                )}
                {data.repos.map((repo) => (
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
            ))}
          </div>
        )}
      </div>

      {/* Clone Section - Fixed at bottom */}
      {selectedRepo && (
        <div className="p-4 border-t border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Clone to:</label>
              <input
                type="text"
                value={clonePath}
                onChange={(e) => setClonePath(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Enter target directory path..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleClone}
                disabled={cloning || !clonePath}
                className="flex-1"
              >
                {cloning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cloning...
                  </>
                ) : (
                  'Clone Repository'
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onBack}
                disabled={cloning}
              >
                Cancel
              </Button>
            </div>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GitHubRepoSelector;