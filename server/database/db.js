import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = path.join(__dirname, 'auth.db');
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

// Create database connection
const db = new Database(DB_PATH);
console.log('Connected to SQLite database');

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSQL);
    console.log('Database initialized successfully');
    
    // Run migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure migrations run in order
      
      for (const file of migrationFiles) {
        try {
          const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          db.exec(migrationSQL);
          console.log(`✅ Applied migration: ${file}`);
        } catch (migrationError) {
          // If migration fails, it might already be applied
          console.log(`⚠️ Migration ${file} may already be applied: ${migrationError.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new user
  createUser: (username, passwordHash) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login, auth_provider, github_username, github_access_token, email, avatar_url FROM users WHERE id = ? AND is_active = 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Get user by GitHub ID
  getUserByGithubId: (githubId) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE github_id = ? AND is_active = 1').get(githubId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Create GitHub user
  createGithubUser: (userData) => {
    try {
      const stmt = db.prepare(
        'INSERT INTO users (username, auth_provider, github_id, github_username, github_access_token, email, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      const result = stmt.run(
        userData.username,
        'github',
        userData.github_id,
        userData.github_username,
        userData.github_access_token,
        userData.email,
        userData.avatar_url
      );
      return { 
        id: result.lastInsertRowid, 
        username: userData.username,
        auth_provider: 'github',
        github_username: userData.github_username,
        github_access_token: userData.github_access_token
      };
    } catch (err) {
      throw err;
    }
  },

  // Update user last login
  updateUserLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // Update GitHub access token
  updateGithubAccessToken: (userId, accessToken) => {
    try {
      db.prepare('UPDATE users SET github_access_token = ? WHERE id = ?').run(accessToken, userId);
    } catch (err) {
      throw err;
    }
  }
};

export {
  db,
  initializeDatabase,
  userDb
};