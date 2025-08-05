# PLANNING.md

## Project Overview

Claude Code UI is a web-based interface for Claude Code CLI that provides desktop and mobile-responsive access to AI-assisted coding workflows. This document outlines the architectural decisions, technology choices, and design rationale behind the system, including the comprehensive extension management system for Sub-Agents, Commands, and Hooks.

## Architecture Overview

### System Design Philosophy

The application follows a **client-server architecture** with real-time communication capabilities and integrated extension management:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │  Claude CLI     │
│   (React/Vite)  │◄──►│ (Express/WS)    │◄──►│  Integration    │
│   + Extensions  │    │ + Extension API │    │ + .claude/      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Key Design Principles:**
- **Separation of Concerns**: Clear boundaries between UI, business logic, Claude CLI integration, and extension management
- **Real-time Communication**: WebSocket-based messaging for live updates and chat functionality
- **Mobile-First Responsive**: Progressive enhancement from mobile to desktop
- **Session Protection**: Prevent UI interruptions during active conversations
- **Extension Ecosystem**: Three-tier classification system for Sub-Agents, Commands, and Hooks

## Technology Stack Rationale

### Frontend Technologies

#### React 18 + Vite
**Why chosen:**
- **Modern Hooks Architecture**: Enables clean state management without Redux complexity
- **Fast Development**: Vite provides instant hot reload and optimized builds
- **Component Reusability**: Modular components for desktop/mobile responsive design
- **Ecosystem**: Rich ecosystem for code editing, markdown rendering, and UI components
- **Extension UI**: Component-based architecture supports dynamic extension management interfaces

#### Tailwind CSS
**Why chosen:**
- **Utility-First**: Rapid prototyping and consistent design system
- **Mobile-First**: Built-in responsive design patterns
- **Dark Mode**: Native dark mode support with CSS variables
- **Bundle Size**: Purging reduces final CSS footprint
- **Extension Styling**: Flexible utility classes for dynamic extension UI components

#### CodeMirror 6
**Why chosen:**
- **Modern Architecture**: Component-based editor with extensible plugins
- **Syntax Highlighting**: Support for multiple programming languages
- **Performance**: Efficient rendering for large files
- **Accessibility**: Built-in keyboard navigation and screen reader support
- **Extension Integration**: Plugin architecture aligns with extension system design

### Backend Technologies

#### Node.js + Express
**Why chosen:**
- **JavaScript Everywhere**: Shared language between frontend and backend
- **Non-blocking I/O**: Essential for WebSocket connections and CLI process management
- **Express Simplicity**: Lightweight framework with middleware flexibility
- **File System Access**: Native Node.js APIs for project file operations and extension management
- **Extension Processing**: Asynchronous processing for extension installation and validation

#### WebSocket (ws library)
**Why chosen:**
- **Real-time Communication**: Essential for chat interface and live project updates
- **Bidirectional**: Enables server-to-client notifications (project changes, Claude responses, extension updates)
- **Low Latency**: Direct connection without HTTP polling overhead
- **Scalability**: Supports multiple concurrent sessions
- **Extension Events**: Real-time extension status updates and notifications

#### SQLite + better-sqlite3
**Why chosen:**
- **Embedded Database**: No external database server required
- **Synchronous API**: Simpler error handling for authentication and session storage
- **File-based**: Easy backup and migration
- **Performance**: Fast for read-heavy workloads (session history, user preferences, extension metadata)
- **Extension Registry**: Efficient storage for extension configurations and classifications

## Core System Features

### Session Protection System

**Problem Solved:**
WebSocket project updates would refresh the sidebar and clear chat messages during active conversations, creating poor UX.

**Solution Architecture:**
```javascript
// Track active sessions to pause project updates
const [activeSessions, setActiveSessions] = useState(new Set());

// Session lifecycle management
markSessionAsActive(sessionId)     // On message send
markSessionAsInactive(sessionId)   // On conversation complete
replaceTemporarySession(realId)    // Handle new session ID assignment
```

**Implementation Strategy:**
- **State-based Protection**: React state tracks active conversations
- **Update Filtering**: Allow additive updates (new sessions) but block changes to active sessions
- **Temporary Session Handling**: Support for new sessions before real IDs are assigned

### Claude CLI Integration

**Integration Approach:**
- **Process Spawning**: Spawn Claude CLI processes per session
- **Non-blocking Execution**: Async process management to prevent UI blocking
- **Session Resumption**: Integration with Claude CLI's session persistence
- **Error Handling**: Graceful fallback for Claude CLI failures
- **Extension Support**: Integration with .claude/ directory structure for agents, commands, and hooks

### File System Operations

**Security Model:**
- **Path Validation**: Restrict access to project directories only
- **Absolute Paths**: Prevent directory traversal attacks
- **Permission Checking**: Validate read/write permissions before operations
- **Chokidar Integration**: Real-time file change detection
- **Extension Sandboxing**: Isolated execution environment for extensions

## Extension Management System

### Three-Tier Classification Architecture

**Classification Types:**
- **Selectable**: Manual selection required per project
- **Default**: Automatically included in new projects (removable)
- **User**: Added at user scope across all projects

**File System Structure:**
```
~/.claude/                          # Global level
├── config/
│   ├── global.json                # Global settings
│   ├── extensions.json            # Extension registry
│   └── security.json              # Security policies
├── agents/
│   ├── registry.json              # Agent metadata
│   ├── installed/                 # Agent packages
│   └── cache/                     # Execution cache
├── commands/
│   ├── registry.json              # Command registry
│   └── user/                      # User commands
└── hooks/
    └── definitions/               # Hook implementations

.claude/                           # Project level
├── config/
│   └── project.json              # Project settings
├── agents/
│   ├── enabled.json              # Enabled agents list
│   └── local/                    # Project agents
├── commands/                     # Project commands
└── hooks/                        # Project hooks
```

### Extension Types

#### Sub-Agents
- **Format**: Markdown files with YAML frontmatter
- **Location**: `.claude/agents/` (project) or `~/.claude/agents/` (global)
- **Features**: Specialized AI assistants with isolated contexts
- **Configuration**: Tool specifications, model selection, prompt engineering

#### Commands
- **Format**: Text files with parameter placeholders
- **Location**: `.claude/commands/` (project) or `~/.claude/commands/` (user)
- **Features**: Reusable prompts with dynamic parameters
- **Capabilities**: File references, bash execution, argument substitution

#### Hooks
- **Format**: JSON configuration files
- **Location**: Settings hierarchy with project override capability
- **Features**: Event-driven automation at lifecycle points
- **Types**: PreToolUse, PostToolUse, Notification, Stop

### Extension API Design

**RESTful Endpoints:**
```
GET    /api/v1/extensions          # List all extensions with filters
POST   /api/v1/extensions          # Install extension
PUT    /api/v1/extensions/{id}     # Update configuration/status
DELETE /api/v1/extensions/{id}     # Uninstall extension

GET    /api/v1/agents              # List agents by classification
POST   /api/v1/agents/install      # Install from source
PUT    /api/v1/agents/{id}/enable  # Enable/disable for project

GET    /api/v1/commands            # List commands by scope
POST   /api/v1/commands            # Create custom command
PUT    /api/v1/commands/{id}       # Update command

GET    /api/v1/hooks               # List hooks by event type
POST   /api/v1/hooks               # Create hook
PUT    /api/v1/hooks/{id}          # Update hook configuration
```

**WebSocket Events:**
```javascript
// Extension status updates
{
  type: 'extension:status',
  data: { id, status, message }
}

// Installation progress
{
  type: 'extension:install',
  data: { id, progress, step }
}

// Hook execution results
{
  type: 'hook:executed',
  data: { hookId, result, timestamp }
}
```

## Responsive Design Strategy

### Mobile-First Approach

**Breakpoint Strategy:**
- **Mobile**: < 768px (primary target)
- **Desktop**: ≥ 768px (progressive enhancement)

**Layout Adaptations:**
- **Mobile**: Bottom navigation, overlay sidebar, touch gestures, extension drawer
- **Desktop**: Fixed sidebar, keyboard shortcuts, multi-panel layout, extension panel

**Progressive Web App (PWA):**
- **Manifest**: Home screen installation
- **Service Worker**: Offline functionality (future enhancement)
- **Touch Optimization**: Proper touch targets and gestures
- **Extension Access**: Mobile-optimized extension management interface

## State Management Architecture

### React Context Strategy

**Selective Context Usage:**
- **AuthContext**: User authentication state (global)
- **ThemeContext**: Dark/light mode preferences (global)
- **ExtensionContext**: Extension state and configuration (global)
- **Component State**: Everything else (prevents unnecessary re-renders)

**Performance Considerations:**
- **Stable Object References**: Prevent unnecessary component re-renders
- **Memoization**: `useMemo` and `useCallback` for expensive operations
- **Debounced Updates**: WebSocket message batching
- **Extension Caching**: Efficient extension metadata caching

### WebSocket State Management

**Custom Hook Architecture:**
```javascript
const { ws, sendMessage, messages } = useWebSocket();
const { extensions, installExtension, updateExtension } = useExtensions();
```

**Message Flow:**
1. **Component** → `sendMessage()` → **WebSocket**
2. **WebSocket** → `messages` state → **Component re-render**
3. **Message Processing** → Update local state → **UI update**
4. **Extension Events** → Update extension state → **UI refresh**

## Security Considerations

### Authentication & Authorization

**JWT-based Authentication:**
- **Stateless Tokens**: No server-side session storage required
- **Expiration Handling**: Automatic token refresh
- **Local Storage**: Secure token storage with fallback

**File Access Security:**
- **Path Validation**: Prevent directory traversal
- **Project Scope**: Restrict access to Claude project directories
- **Permission Checks**: Validate file system permissions
- **Extension Sandboxing**: Isolated execution environments

### Extension Security Model

**Permission System:**
- **Capability-based**: Granular permission controls
- **Resource Quotas**: CPU, memory, disk, network limits
- **Sandboxing**: Process isolation for untrusted extensions
- **Validation Pipeline**: Multi-stage validation for extension installation

**Security Policies:**
```json
{
  "extensions": {
    "allowUntrusted": false,
    "requireSignatures": true,
    "maxResourceUsage": {
      "cpu": "50%",
      "memory": "512MB",
      "disk": "1GB"
    }
  }
}
```

## Performance Optimizations

### Frontend Optimizations

**Bundle Optimization:**
- **Vite Tree Shaking**: Eliminate unused code
- **Dynamic Imports**: Code splitting for large components and extensions
- **Asset Optimization**: Image compression and lazy loading

**Runtime Performance:**
- **Virtual Scrolling**: For large extension lists and file trees
- **Debounced Updates**: Prevent excessive WebSocket messages
- **Memoized Components**: Reduce unnecessary re-renders
- **Extension Lazy Loading**: Load extensions on demand

### Backend Optimizations

**Process Management:**
- **Process Pooling**: Reuse Claude CLI processes when possible
- **Memory Management**: Clean up terminated processes
- **Error Recovery**: Restart failed Claude processes
- **Extension Process Isolation**: Separate process spaces for extensions

**Database Optimization:**
- **Indexed Queries**: Optimize frequent lookups for extensions
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Minimize database round-trips
- **Extension Metadata Caching**: In-memory cache for frequently accessed data

## Extension Ecosystem Integration

### Source Management

**Supported Sources:**
- **GitHub Repositories**: Direct installation from Git repositories
- **NPM Packages**: Package manager integration
- **Local Files**: Manual installation from local directories
- **Extension Registries**: Community-maintained extension catalogs

**Installation Methods:**
```javascript
// GitHub installation
installExtension({
  source: 'github',
  url: 'https://github.com/user/claude-extension',
  classification: 'selectable'
});

// NPM installation
installExtension({
  source: 'npm',
  package: '@claude/extension-name',
  classification: 'default'
});
```

### Community Integration

**Extension Discovery:**
- **Built-in Browser**: Search and discover community extensions
- **Rating System**: Community ratings and reviews
- **Categorization**: Organized by functionality and use case
- **Dependency Management**: Automatic dependency resolution

**Publishing Pipeline:**
- **Extension Validator**: Automated testing and validation
- **Documentation Generator**: Automatic documentation from metadata
- **Version Management**: Semantic versioning support
- **Update Notifications**: Automatic update detection and notification

## Development Workflow

### Hot Reload Development

**Concurrent Development:**
```bash
npm run dev  # Runs both server and client with hot reload + extension watcher
```

**Development Features:**
- **Server Auto-restart**: Nodemon for backend changes
- **Client Hot Reload**: Vite HMR for frontend changes
- **Extension Hot Reload**: Automatic extension reloading during development
- **Proxy Configuration**: Seamless API calls during development

### Build and Deployment

**Production Build:**
```bash
npm run build    # Vite optimization + extension bundling
npm run start    # Production server with extension support
```

**Deployment Considerations:**
- **Static Asset Serving**: Express serves built frontend and extension assets
- **Environment Configuration**: .env file management for extensions
- **Process Management**: PM2 or similar for production with extension monitoring

## Future Enhancements

### Planned Features

**Advanced Extension Support:**
- **Extension Store**: Centralized marketplace for extensions
- **Extension IDE**: Built-in editor for creating and testing extensions
- **Performance Analytics**: Extension performance monitoring and optimization
- **A/B Testing**: Extension effectiveness testing framework

**Enhanced Mobile Support:**
- **Offline Extensions**: Service worker support for offline extension functionality
- **Push Notifications**: Extension-triggered notifications
- **Native App**: Electron or Tauri wrapper with native extension support

**Collaboration Features:**
- **Shared Extensions**: Team-wide extension sharing and management
- **Extension Workspaces**: Project-specific extension configurations
- **Extension Permissions**: Role-based access control for extensions

### Technical Debt & Improvements

**Code Quality:**
- **TypeScript Migration**: Gradual migration to TypeScript for extension system
- **Test Coverage**: Comprehensive unit and integration tests for extensions
- **API Documentation**: OpenAPI/Swagger documentation for extension APIs

**Performance:**
- **Extension Caching**: Redis for extension metadata and execution caching
- **CDN Integration**: Extension asset delivery optimization
- **Database Migration**: PostgreSQL for advanced extension analytics

## Conclusion

Claude Code UI now represents a comprehensive platform that bridges Claude CLI's capabilities with modern web interfaces while providing a robust extension ecosystem. The three-tier classification system (Selectable, Default, User) enables flexible extension management that scales from individual developers to enterprise teams.

The modular architecture supports incremental improvements and feature additions while maintaining stability and performance across desktop and mobile platforms. The extension system's security-first approach ensures safe execution of community-contributed agents, commands, and hooks while providing the flexibility needed for diverse development workflows.

The integration with the broader Claude Code ecosystem through standardized formats, community sources, and real-time synchronization creates a powerful platform for AI-assisted development that can evolve with the needs of its users.