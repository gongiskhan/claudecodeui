import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = path.join(__dirname, 'server/database/auth.db');

// Create database connection
const db = new Database(DB_PATH);
console.log('Connected to SQLite database for migration');

try {
  // Check if github_id column exists
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const hasGithubId = tableInfo.some(col => col.name === 'github_id');
  const hasAccessToken = tableInfo.some(col => col.name === 'github_access_token');
  
  if (!hasGithubId) {
    console.log('Applying GitHub OAuth migration...');
    
    // Disable foreign keys temporarily
    db.exec('PRAGMA foreign_keys = OFF');
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Create new table with GitHub fields
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT, -- Now nullable for OAuth users
        auth_provider TEXT DEFAULT 'local',
        github_id TEXT UNIQUE,
        github_username TEXT,
        github_access_token TEXT,
        email TEXT,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1
      )
    `);
    
    // Copy existing data
    db.exec(`
      INSERT INTO users_new (id, username, password_hash, created_at, last_login, is_active)
      SELECT id, username, password_hash, created_at, last_login, is_active FROM users
    `);
    
    // Drop old table
    db.exec('DROP TABLE users');
    
    // Rename new table
    db.exec('ALTER TABLE users_new RENAME TO users');
    
    // Recreate indexes
    db.exec('CREATE INDEX idx_users_username ON users(username)');
    db.exec('CREATE INDEX idx_users_active ON users(is_active)');
    db.exec('CREATE INDEX idx_users_github_id ON users(github_id)');
    db.exec('CREATE INDEX idx_users_auth_provider ON users(auth_provider)');
    
    // Create sessions table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      )
    `);
    
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)');
    
    // Commit transaction
    db.exec('COMMIT');
    
    // Re-enable foreign keys
    db.exec('PRAGMA foreign_keys = ON');
    
    console.log('✅ GitHub OAuth migration applied successfully');
  } else if (!hasAccessToken) {
    console.log('Adding GitHub access token column...');
    
    // Add github_access_token column if it doesn't exist
    db.exec('ALTER TABLE users ADD COLUMN github_access_token TEXT');
    
    console.log('✅ GitHub access token column added successfully');
  } else {
    console.log('✅ Database already has all GitHub OAuth columns');
  }
  
  // Verify the schema
  const newTableInfo = db.prepare("PRAGMA table_info(users)").all();
  console.log('Current users table columns:', newTableInfo.map(col => col.name).join(', '));
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}