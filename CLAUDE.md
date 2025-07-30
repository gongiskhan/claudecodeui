# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code UI is a web-based interface for Claude Code CLI that provides a responsive desktop and mobile experience. It's built with React/Vite frontend and Node.js/Express backend with WebSocket communication.

## Development Commands

### Core Development
- `npm install` - Install all dependencies
- `npm run dev` - Start both server and client in development mode (runs on ports 3001 client, 3002 server by default)
- `npm run server` - Start only the Express server
- `npm run client` - Start only the Vite dev server  
- `npm run build` - Build for production
- `npm run start` - Build and start production server

### Environment Setup
- Copy `.env.example` to `.env` and configure ports and settings
- Default ports: CLIENT=3001, SERVER=3002
- Server runs on 0.0.0.0 binding for network access

## Architecture Overview

### Frontend (React + Vite)
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Core Components**: 
  - `ChatInterface.jsx` - Main chat UI with Claude CLI integration
  - `Sidebar.jsx` - Project and session management
  - `MainContent.jsx` - Tab container (chat, files, git)
  - `Shell.jsx` - Integrated terminal for Claude CLI
- **State Management**: React Context for auth and theme, WebSocket for real-time updates
- **Responsive Design**: Mobile-first with touch navigation and PWA support

### Backend (Node.js + Express)
- **Server**: `server/index.js` - Main Express server with dual WebSocket endpoints
- **WebSocket Handlers**: 
  - `/ws` - Chat communication with Claude CLI
  - `/shell` - Terminal emulation using node-pty
- **Authentication**: JWT-based with SQLite storage (`server/database/`)
- **Claude Integration**: `server/claude-cli.js` - Process spawning and session management

### Key Integrations
- **Claude CLI**: Spawned processes with session resumption support
- **File System**: Real-time project file browsing and editing
- **Git Operations**: Status, staging, commits through `server/routes/git.js`
- **Audio Transcription**: OpenAI Whisper integration for voice input
- **MCP Support**: Integration with Model Context Protocol servers

## Critical System: Session Protection

The app implements a **Session Protection System** to prevent WebSocket project updates from interrupting active conversations:

### How It Works
1. When user sends message → session marked as "active" 
2. Project updates are paused during active sessions
3. When conversation completes/aborts → session marked as "inactive"
4. Updates resume normally

### Implementation Files
- `src/App.jsx:75-411` - Core protection logic and state management
- `src/components/ChatInterface.jsx:1-17` - Integration points for session lifecycle

### Key Functions
- `markSessionAsActive(sessionId)` - Called on message send
- `markSessionAsInactive(sessionId)` - Called on conversation end
- `replaceTemporarySession(realSessionId)` - Handles new session ID assignment

## Component Architecture Patterns

### State Management Strategy
- Use React Context sparingly (auth, theme only)
- Prefer component-level state with careful prop drilling
- WebSocket state managed in custom hooks (`src/utils/websocket.js`)
- Optimize re-renders with `memo()` and stable object references

### Mobile-First Responsive Design
- `isMobile` state drives layout switching (768px breakpoint)
- Bottom navigation for mobile (`MobileNav.jsx`)
- Sidebar overlay system with touch handling
- PWA manifest for home screen installation

### Real-Time Updates
- Chokidar file watching for project changes
- WebSocket broadcasting to connected clients
- Debounced updates (300ms) to prevent excessive notifications
- Smart diff checking to minimize unnecessary re-renders

## File Organization

### Frontend Structure
```
src/
├── components/       # React components
├── contexts/        # React Context providers (auth, theme)
├── hooks/          # Custom React hooks
├── utils/          # API client, WebSocket, utilities
└── lib/            # Shared utilities (Tailwind merge)
```

### Backend Structure
```
server/
├── routes/         # Express route handlers (auth, git, mcp)
├── middleware/     # Auth and validation middleware
├── database/       # SQLite schema and connection
└── claude-cli.js   # Claude CLI process management
```

## Development Guidelines

### Code Style
- Uses Tailwind CSS with design system tokens in `tailwind.config.js`
- Components follow mobile-first responsive patterns
- Error boundaries implemented for stability
- TypeScript JSDoc comments for better IDE support

### Performance Considerations
- Message history truncated to 50 items to prevent localStorage quota issues
- File tree limited to depth 3 for performance
- Debounced WebSocket updates
- Lazy loading for heavy components

### Security
- JWT authentication required for all API endpoints
- File access restricted to absolute paths with validation
- CORS configured for development proxy
- User uploads cleaned up automatically

## Common Development Tasks

### Adding New API Endpoints
1. Create route handler in `server/routes/`
2. Add authentication middleware
3. Update `src/utils/api.js` client
4. Test with both development and production builds

### Modifying WebSocket Communication
1. Update handlers in `server/index.js` (lines 428-655)
2. Modify WebSocket hook in `src/utils/websocket.js`
3. Update component message handling

### Adding New Tool/Component Integration
1. Follow existing patterns in `src/components/`
2. Use proper responsive design patterns
3. Integrate with session protection system if needed
4. Add mobile navigation support if applicable

## Testing and Debugging

### Development Environment
- Hot reload enabled for both client and server
- Source maps enabled for debugging
- Console logging with emoji prefixes for easy filtering
- WebSocket connection status visible in UI

### Production Considerations
- Built files served from `dist/` directory  
- Environment variables loaded from `.env` file
- Process management for Claude CLI spawning
- Graceful WebSocket connection handling