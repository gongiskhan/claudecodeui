# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code UI is a web-based interface for Claude Code CLI that provides a responsive desktop and mobile experience with comprehensive extension management. It's built with React/Vite frontend and Node.js/Express backend with WebSocket communication, featuring a three-tier classification system for Sub-Agents, Commands, and Hooks.

## Development Commands

### Core Development
- `npm install` - Install all dependencies
- `npm run dev` - Start both server and client in development mode with extension watcher (runs on ports 3001 client, 3002 server by default)
- `npm run server` - Start only the Express server
- `npm run client` - Start only the Vite dev server  
- `npm run build` - Build for production with extension bundling
- `npm run start` - Build and start production server with extension support

### Extension Development
- `npm run extension:validate` - Validate extension configurations
- `npm run extension:test` - Run extension-specific tests
- `npm run extension:watch` - Watch for extension changes during development

### Environment Setup
- Copy `.env.example` to `.env` and configure ports and settings
- Default ports: CLIENT=3001, SERVER=3002
- Server runs on 0.0.0.0 binding for network access
- Extension system requires `.claude/` directory structure

## Architecture Overview

### Frontend (React + Vite)
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Core Components**: 
  - `ChatInterface.jsx` - Main chat UI with Claude CLI integration
  - `Sidebar.jsx` - Project and session management with extension sidebar
  - `MainContent.jsx` - Tab container (chat, files, git, extensions)
  - `Shell.jsx` - Integrated terminal for Claude CLI
  - `ExtensionManager.jsx` - Extension management interface
  - `AgentBrowser.jsx` - Sub-agent discovery and installation
  - `CommandPalette.jsx` - Command management and execution
  - `HookConfiguration.jsx` - Hook setup and monitoring
- **State Management**: React Context for auth, theme, and extensions; WebSocket for real-time updates
- **Responsive Design**: Mobile-first with touch navigation, PWA support, and mobile extension management

### Backend (Node.js + Express)
- **Server**: `server/index.js` - Main Express server with dual WebSocket endpoints and extension API
- **WebSocket Handlers**: 
  - `/ws` - Chat communication with Claude CLI
  - `/shell` - Terminal emulation using node-pty
  - `/extensions` - Extension status updates and notifications
- **Authentication**: JWT-based with SQLite storage (`server/database/`)
- **Claude Integration**: `server/claude-cli.js` - Process spawning and session management with .claude/ directory support
- **Extension System**: 
  - `server/extensions/` - Extension management, validation, and execution
  - `server/extensions/agents.js` - Sub-agent lifecycle management
  - `server/extensions/commands.js` - Command parsing and execution
  - `server/extensions/hooks.js` - Hook event system and processing

### Key Integrations
- **Claude CLI**: Spawned processes with session resumption and .claude/ directory integration
- **File System**: Real-time project file browsing, editing, and extension file management
- **Git Operations**: Status, staging, commits through `server/routes/git.js`
- **Audio Transcription**: OpenAI Whisper integration for voice input
- **MCP Support**: Integration with Model Context Protocol servers
- **Extension Ecosystem**: Three-tier classification with community source integration

## Extension System Architecture

### Three-Tier Classification System

**Classification Types:**
- **Selectable**: Extensions that must be manually selected per project
- **Default**: Extensions automatically included in new projects (but removable)
- **User**: Extensions added at user scope across all projects

### File System Structure

**Global Level** (`~/.claude/`):
```
~/.claude/
├── config/
│   ├── global.json           # Global settings
│   ├── extensions.json       # Extension registry
│   └── security.json         # Security policies
├── agents/
│   ├── registry.json         # Agent metadata
│   ├── installed/           # Agent packages
│   └── cache/              # Execution cache
├── commands/
│   ├── registry.json        # Command registry
│   └── user/               # User commands
└── hooks/
    └── definitions/         # Hook implementations
```

**Project Level** (`.claude/`):
```
.claude/
├── config/
│   └── project.json         # Project settings
├── agents/
│   ├── enabled.json        # Enabled agents list
│   └── local/             # Project agents
├── commands/               # Project commands
└── hooks/                 # Project hooks
```

### Extension Types

#### Sub-Agents
- **Format**: Markdown files with YAML frontmatter
- **Example Structure**:
```markdown
---
name: frontend-specialist
description: Expert in React, Vue, and modern frontend frameworks
classification: selectable
tools: web_search, file_editor
model: sonnet
---

You are a frontend development specialist focused on modern web technologies.
```

#### Commands
- **Format**: Text files with parameter placeholders
- **Example Structure**:
```
/analyze-component $COMPONENT_NAME
Analyze the React component at @$COMPONENT_NAME and suggest improvements for:
- Performance optimization
- Accessibility compliance
- Code maintainability
```

#### Hooks
- **Format**: JSON configuration files
- **Example Structure**:
```json
{
  "name": "pre-commit-validation",
  "event": "PreToolUse",
  "condition": "tool === 'git_commit'",
  "command": "npm run lint && npm run test",
  "timeout": 30000
}
```

## Critical System: Session Protection

The app implements a **Session Protection System** to prevent WebSocket project updates from interrupting active conversations, extended to include extension updates:

### How It Works
1. When user sends message → session marked as "active" 
2. Project updates AND extension updates are paused during active sessions
3. When conversation completes/aborts → session marked as "inactive"
4. Updates resume normally

### Implementation Files
- `src/App.jsx:75-411` - Core protection logic and state management
- `src/components/ChatInterface.jsx:1-17` - Integration points for session lifecycle
- `src/contexts/ExtensionContext.jsx` - Extension-specific session protection

### Key Functions
- `markSessionAsActive(sessionId)` - Called on message send
- `markSessionAsInactive(sessionId)` - Called on conversation end
- `replaceTemporarySession(realSessionId)` - Handles new session ID assignment
- `pauseExtensionUpdates(sessionId)` - Prevents extension updates during active sessions
- `resumeExtensionUpdates(sessionId)` - Resumes extension updates after session completion

## Extension Management Patterns

### State Management Strategy
- Use React Context for global extension state (`ExtensionContext`)
- Component-level state for extension-specific UI interactions
- WebSocket state for real-time extension status updates
- Optimize re-renders with `memo()` and stable object references for extension lists

### Extension API Patterns

**RESTful Endpoints**:
```javascript
// Extension management
GET    /api/v1/extensions              # List all with classification filters
POST   /api/v1/extensions              # Install extension
PUT    /api/v1/extensions/{id}         # Update configuration/status
DELETE /api/v1/extensions/{id}         # Uninstall extension

// Sub-agent specific
GET    /api/v1/agents                  # List agents by classification
POST   /api/v1/agents/install          # Install from source
PUT    /api/v1/agents/{id}/enable      # Enable/disable for project

// Command management
GET    /api/v1/commands                # List commands by scope
POST   /api/v1/commands                # Create custom command
PUT    /api/v1/commands/{id}           # Update command

// Hook management
GET    /api/v1/hooks                   # List hooks by event type
POST   /api/v1/hooks                   # Create hook
PUT    /api/v1/hooks/{id}              # Update hook configuration
```

**WebSocket Events**:
```javascript
// Extension status updates
{
  type: 'extension:status',
  data: { id, status, message, classification }
}

// Installation progress
{
  type: 'extension:install', 
  data: { id, progress, step, source }
}

// Agent execution results
{
  type: 'agent:executed',
  data: { agentId, result, timestamp, sessionId }
}

// Hook execution notifications
{
  type: 'hook:executed',
  data: { hookId, event, result, timestamp }
}
```

### Mobile-First Extension Design
- Extension browser with card-based layout for touch interfaces
- Bottom sheet modals for extension configuration on mobile
- Extension quick actions accessible from chat interface
- Touch-optimized extension settings with proper target sizes
- Progressive disclosure for complex extension configurations

### Extension Security Implementation
- Validate all extension configurations against JSON schemas
- Implement process sandboxing for extension execution
- Resource quota enforcement (CPU, memory, disk, network)
- Permission-based access control for extension capabilities
- Input sanitization for extension parameters and configurations

## File Organization

### Frontend Structure
```
src/
├── components/
│   ├── extensions/      # Extension management components
│   │   ├── ExtensionBrowser.jsx
│   │   ├── AgentManager.jsx
│   │   ├── CommandPalette.jsx
│   │   └── HookConfiguration.jsx
│   ├── chat/           # Chat interface components
│   ├── project/        # Project management components
│   └── shared/         # Shared UI components
├── contexts/
│   ├── ExtensionContext.jsx  # Extension state management
│   ├── AuthContext.jsx       # Authentication context
│   └── ThemeContext.jsx      # Theme management
├── hooks/
│   ├── useExtensions.js      # Extension management hook
│   ├── useAgents.js          # Sub-agent management hook
│   └── useWebSocket.js       # WebSocket communication
├── utils/
│   ├── extensionApi.js       # Extension API client
│   ├── agentValidator.js     # Agent configuration validation
│   └── commandParser.js     # Command parsing utilities
└── lib/                      # Shared utilities
```

### Backend Structure
```
server/
├── routes/
│   ├── extensions.js    # Extension management endpoints
│   ├── agents.js       # Sub-agent specific endpoints
│   ├── commands.js     # Command management endpoints
│   ├── hooks.js        # Hook management endpoints
│   ├── auth.js         # Authentication routes
│   └── git.js          # Git operations
├── extensions/
│   ├── manager.js      # Extension lifecycle management
│   ├── validator.js    # Extension validation logic
│   ├── installer.js    # Extension installation pipeline
│   ├── agents/        # Agent-specific logic
│   ├── commands/      # Command processing logic
│   └── hooks/         # Hook event system
├── middleware/
│   ├── auth.js         # Authentication middleware
│   ├── validation.js   # Request validation
│   └── security.js     # Security controls
├── database/
│   ├── schema.sql      # Database schema including extensions
│   ├── connection.js   # Database connection management
│   └── migrations/     # Database migrations
└── claude-cli.js       # Claude CLI integration with extension support
```

## Development Guidelines

### Extension Development Patterns
- Follow the three-tier classification system for all new extensions
- Implement proper error boundaries for extension components
- Use TypeScript JSDoc comments for better IDE support in extension code
- Follow security-first principles with input validation and sandboxing
- Implement comprehensive logging for extension debugging

### Extension Testing Strategies
- Unit tests for extension validation and processing logic
- Integration tests for extension API endpoints
- End-to-end tests for complete extension workflows
- Performance tests for extension execution under load
- Security tests for sandboxing and permission enforcement

### Code Style for Extensions
- Uses Tailwind CSS with design system tokens for extension UI
- Components follow mobile-first responsive patterns
- Extension configurations validated against JSON schemas
- Consistent error handling with user-friendly messages
- Proper cleanup in extension lifecycle hooks

### Performance Considerations for Extensions
- Extension metadata cached for fast browsing
- Lazy loading for extension content and configuration
- Debounced extension status updates
- Virtual scrolling for large extension lists
- Resource monitoring for extension execution

### Security Guidelines for Extensions
- All extension installations require explicit user approval
- Extension permissions clearly displayed before installation
- Process isolation for untrusted extension code
- Resource quotas enforced for all extension execution
- Audit logging for all extension operations

## Common Development Tasks

### Adding New Extension Types
1. Define schema in `server/extensions/schemas/`
2. Create validation logic in `server/extensions/validator.js`
3. Add API endpoints in `server/routes/extensions.js`
4. Create frontend components in `src/components/extensions/`
5. Update extension context and hooks
6. Add comprehensive tests for the new extension type

### Modifying Extension Classification System
1. Update database schema for new classification types
2. Modify extension validation logic
3. Update API endpoints to handle new classifications
4. Adjust frontend UI components for new classification display
5. Update documentation and examples

### Adding Extension Sources
1. Create source adapter in `server/extensions/sources/`
2. Implement source-specific installation logic
3. Add source configuration to extension installer
4. Create frontend source selection UI
5. Add source-specific validation and testing

### Extension WebSocket Communication
1. Update handlers in `server/index.js` WebSocket sections
2. Modify extension WebSocket hook in `src/hooks/useExtensions.js`
3. Update extension components to handle real-time events
4. Add proper error handling for extension WebSocket messages

### Testing Extension Features
1. Unit tests for extension logic in `tests/unit/extensions/`
2. Integration tests for extension API in `tests/integration/`
3. End-to-end tests for extension workflows in `tests/e2e/`
4. Performance tests for extension execution
5. Security tests for extension sandboxing

## Extension Development Environment

### Development Tools
- Hot reload enabled for extension configuration changes
- Extension validation runs automatically on file changes
- Real-time extension status updates in development console
- Extension debugging tools accessible through dev interface
- Extension performance profiling available in development mode

### Extension Testing Environment
- Isolated test environment for extension development
- Mock Claude CLI integration for extension testing
- Extension test fixtures and sample configurations
- Automated extension validation in CI/CD pipeline
- Extension security testing with controlled environments

### Extension Debugging
- Comprehensive logging for extension lifecycle events
- Extension execution tracing with performance metrics
- Extension error reporting with stack traces and context
- Extension state inspection tools in development interface
- Extension communication debugging with message tracing

## Production Considerations

### Extension Deployment
- Extension configurations validated before deployment
- Extension registry synchronized across environments
- Extension rollback capabilities for failed deployments
- Extension monitoring and alerting in production
- Extension backup and recovery procedures

### Extension Performance
- Extension execution monitoring with metrics collection
- Extension resource usage tracking and optimization
- Extension caching strategies for improved performance
- Extension load balancing for high-traffic scenarios
- Extension scaling considerations for enterprise deployments

### Extension Security in Production
- Extension sandboxing enforced with container isolation
- Extension permission auditing with compliance tracking
- Extension update validation with security scanning
- Extension vulnerability management and patching
- Extension incident response procedures and playbooks

This comprehensive extension system transforms Claude Code UI from a simple interface into a powerful, extensible platform that can adapt to diverse development workflows while maintaining security, performance, and usability standards.