import express from 'express';
import bcrypt from 'bcrypt';
import { userDb, db } from '../database/db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import passport from '../auth/passport.js';
import { isAllowedUser } from '../auth/strategies/github.js';

const router = express.Router();

// Check auth status and setup requirements
router.get('/status', async (req, res) => {
  try {
    const hasUsers = await userDb.hasUsers();
    const githubConfigured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    const allowedUsers = process.env.GITHUB_ALLOWED_USERS 
      ? process.env.GITHUB_ALLOWED_USERS.split(',').map(u => u.trim())
      : [];
    
    res.json({ 
      needsSetup: !hasUsers,
      isAuthenticated: false, // Will be overridden by frontend if token exists
      githubConfigured,
      githubAllowedUsers: allowedUsers
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Local login endpoint (kept for existing users)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const user = await userDb.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user);
    
    // Update last login
    userDb.updateUserLastLogin(user.id);
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        auth_provider: user.auth_provider || 'local'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user (protected route)
router.get('/user', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// Logout (client-side token removal, but this endpoint can be used for logging)
router.post('/logout', authenticateToken, (req, res) => {
  // In a simple JWT system, logout is mainly client-side
  // This endpoint exists for consistency and potential future logging
  res.json({ success: true, message: 'Logged out successfully' });
});

// GitHub OAuth routes
router.get('/github', (req, res, next) => {
  // Store the original URL if provided
  if (req.query.returnUrl) {
    req.session.returnUrl = req.query.returnUrl;
  }
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login?error=github_auth_failed' }),
  async (req, res) => {
    try {
      // Generate JWT token for the authenticated user
      const token = generateToken(req.user);
      
      // Update last login
      userDb.updateUserLastLogin(req.user.id);
      
      // Redirect to client with token
      const returnUrl = req.session.returnUrl || '/';
      delete req.session.returnUrl;
      
      // Redirect with token in query parameter (client will handle storing it)
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3009'}${returnUrl}?token=${token}`);
    } catch (error) {
      console.error('GitHub callback error:', error);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3009'}/login?error=auth_failed`);
    }
  }
);

// Check if a GitHub username is allowed
router.get('/github/check/:username', (req, res) => {
  const { username } = req.params;
  const allowed = isAllowedUser(username);
  res.json({ allowed });
});

// Get GitHub authentication status
router.get('/github/status', authenticateToken, (req, res) => {
  console.log('GitHub status check for user:', req.user);
  const response = {
    isGithubAuthenticated: req.user.auth_provider === 'github',
    githubUsername: req.user.github_username || null
  };
  console.log('GitHub status response:', response);
  res.json(response);
});

export default router;