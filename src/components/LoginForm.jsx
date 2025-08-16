import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Github } from 'lucide-react';
import { api } from '../utils/api';

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authStatus, setAuthStatus] = useState({});
  const [useLocalAuth, setUseLocalAuth] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { error: authError } = useAuth();
  
  useEffect(() => {
    // Get auth status including GitHub configuration
    const checkAuthStatus = async () => {
      try {
        const response = await api.auth.status();
        const data = await response.json();
        setAuthStatus(data);
        // If GitHub is not configured, default to local auth
        if (!data.githubConfigured) {
          setUseLocalAuth(true);
        }
      } catch (err) {
        console.error('Failed to check auth status:', err);
      }
    };
    checkAuthStatus();
  }, []);

  const handleGithubLogin = () => {
    setIsLoading(true);
    // Redirect to GitHub OAuth endpoint
    window.location.href = `${window.location.origin}/api/auth/github`;
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Store token and reload
        localStorage.setItem('auth-token', data.token);
        window.location.reload();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border border-border p-8 space-y-6">
          {/* Logo and Title */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                <MessageSquare className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome to Claude Code UI</h1>
            <p className="text-muted-foreground mt-2">
              Sign in to continue
            </p>
          </div>

          {/* Login Options */}
          {useLocalAuth ? (
            // Local Login Form
            <form onSubmit={handleLocalLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-medium py-2 px-4 rounded-md transition-colors duration-200"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>

              {authStatus.githubConfigured && (
                <button
                  type="button"
                  onClick={() => setUseLocalAuth(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in with GitHub instead
                </button>
              )}
            </form>
          ) : (
            // GitHub Login
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGithubLogin}
                disabled={isLoading}
                className="w-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Github className="w-5 h-5" />
                {isLoading ? 'Redirecting...' : 'Sign in with GitHub'}
              </button>
              
              <button
                type="button"
                onClick={() => setUseLocalAuth(true)}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in with username and password
              </button>
              
              {authStatus.githubAllowedUsers && authStatus.githubAllowedUsers.length > 0 && (
                <div className="text-xs text-center text-muted-foreground">
                  Allowed users: {authStatus.githubAllowedUsers.join(', ')}
                </div>
              )}
            </div>
          )}
          
          {(error || authError) && (
            <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-400">{error || authError}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginForm;