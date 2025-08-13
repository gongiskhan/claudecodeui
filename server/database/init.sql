-- Initialize authentication database
PRAGMA foreign_keys = ON;

-- Users table (supports both local and GitHub authentication)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- Nullable for OAuth users
    auth_provider TEXT DEFAULT 'local',
    github_id TEXT UNIQUE,
    github_username TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1
);

-- Sessions table for OAuth state management
CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Extension system tables
CREATE TABLE IF NOT EXISTS extensions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    classification TEXT CHECK(classification IN ('selectable', 'default', 'user')) NOT NULL,
    type TEXT CHECK(type IN ('agent', 'command', 'hook')) NOT NULL,
    source TEXT,
    source_url TEXT,
    file_path TEXT,
    config JSON,
    status TEXT CHECK(status IN ('installed', 'enabled', 'disabled', 'error')) DEFAULT 'installed',
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    installed_by INTEGER REFERENCES users(id),
    resource_usage JSON,
    permissions JSON
);

-- Extension dependencies
CREATE TABLE IF NOT EXISTS extension_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extension_id TEXT NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
    dependency_id TEXT NOT NULL,
    version_constraint TEXT,
    required BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project extension configurations
CREATE TABLE IF NOT EXISTS project_extensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_path TEXT NOT NULL,
    extension_id TEXT NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT 1,
    config_override JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_path, extension_id)
);

-- Extension execution logs
CREATE TABLE IF NOT EXISTS extension_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extension_id TEXT NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
    project_path TEXT,
    event_type TEXT NOT NULL,
    status TEXT CHECK(status IN ('success', 'error', 'timeout')) NOT NULL,
    execution_time INTEGER, -- milliseconds
    memory_used INTEGER, -- bytes
    error_message TEXT,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Extension security policies
CREATE TABLE IF NOT EXISTS extension_security (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extension_id TEXT NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL,
    resource_limit INTEGER,
    allowed_operations JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(extension_id, permission_type)
);

-- Hook system tables
CREATE TABLE IF NOT EXISTS hooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    event TEXT NOT NULL,
    condition TEXT DEFAULT 'always',
    condition_params JSON,
    command TEXT NOT NULL,
    timeout INTEGER DEFAULT 30000,
    enabled BOOLEAN DEFAULT 1,
    project_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Hook execution logs
CREATE TABLE IF NOT EXISTS hook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hook_id TEXT NOT NULL REFERENCES hooks(id) ON DELETE CASCADE,
    project_path TEXT,
    event_type TEXT NOT NULL,
    status TEXT CHECK(status IN ('success', 'error', 'timeout')) NOT NULL,
    execution_time INTEGER, -- milliseconds
    error_message TEXT,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for extension system
CREATE INDEX IF NOT EXISTS idx_extensions_classification ON extensions(classification);
CREATE INDEX IF NOT EXISTS idx_extensions_type ON extensions(type);
CREATE INDEX IF NOT EXISTS idx_extensions_status ON extensions(status);
CREATE INDEX IF NOT EXISTS idx_extension_dependencies_extension ON extension_dependencies(extension_id);
CREATE INDEX IF NOT EXISTS idx_project_extensions_project ON project_extensions(project_path);
CREATE INDEX IF NOT EXISTS idx_project_extensions_extension ON project_extensions(extension_id);
CREATE INDEX IF NOT EXISTS idx_extension_logs_extension ON extension_logs(extension_id);
CREATE INDEX IF NOT EXISTS idx_extension_logs_created ON extension_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_extension_security_extension ON extension_security(extension_id);

-- Workflow system tables
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger JSON NOT NULL,
    steps JSON NOT NULL,
    settings JSON,
    enabled BOOLEAN DEFAULT 1,
    project_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    project_path TEXT,
    event_type TEXT NOT NULL,
    status TEXT CHECK(status IN ('success', 'error', 'timeout')) NOT NULL,
    execution_time INTEGER, -- milliseconds
    error_message TEXT,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for hook system
CREATE INDEX IF NOT EXISTS idx_hooks_event ON hooks(event);
CREATE INDEX IF NOT EXISTS idx_hooks_enabled ON hooks(enabled);
CREATE INDEX IF NOT EXISTS idx_hooks_project ON hooks(project_path);
CREATE INDEX IF NOT EXISTS idx_hook_logs_hook ON hook_logs(hook_id);
CREATE INDEX IF NOT EXISTS idx_hook_logs_created ON hook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_hook_logs_event ON hook_logs(event_type);

-- Indexes for workflow system
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);
CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflows(project_path);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_created ON workflow_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_event ON workflow_logs(event_type);
