# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WatchAPI is a VS Code extension that auto-imports API endpoints from Next.js, NestJS, and tRPC backend code. It enables developers to test APIs directly within VS Code without manual endpoint setup.

## Commands

```bash
pnpm install          # Install dependencies
pnpm run watch        # Watch mode (TSC + esbuild in parallel)
pnpm run check-types  # Type checking
pnpm run lint         # ESLint
pnpm run test         # Run tests
pnpm run package      # Build production bundle
```

Debug: Press F5 in VS Code to launch extension in debug mode.

## Architecture

### Dual-Mode Operation

The extension operates in two modes:
- **Local Mode** (unauthenticated): Data stored in VS Code's `globalState`
- **Cloud Mode** (authenticated): Data synced with backend via tRPC

Services check `isCloudMode()` to determine data source. On first login, local data migrates to cloud.

### Module Structure

```
src/
├── extension.ts          # Entry point - initializes all services and registers commands
├── api/                  # tRPC client for backend communication
├── auth/                 # OAuth flow, token storage (SecretStorage), session management
├── collections/          # Collection CRUD, TreeDataProvider for sidebar
├── endpoints/            # Endpoint CRUD, virtual filesystem (watchapi://)
├── environments/         # Environment variables (rest-client.env.json)
├── organizations/        # Multi-org support
├── commands/             # Command handlers with error wrapping
├── sync/                 # Auto-sync service (5s interval when authenticated)
├── ui/
│   └── execute-request/  # HTTP request execution, response rendering, CodeLens
├── parsers/              # .http file format parsing
├── storage/              # LocalStorageService (globalState wrapper)
└── shared/               # Types, constants, errors, config, utilities
```

### Key Patterns

**Layered Schema Approach**: Endpoints have `*Schema` (code-inferred, updated by sync) and `*Overrides` (user edits, preserved during sync) for body, headers, and query params.

**Virtual Filesystem**: Endpoints accessed via `watchapi://collection-id/endpoint-id.http`

**Event-Driven Updates**: Services emit events via VS Code EventEmitters; UI components subscribe and refresh.

**Command Wrapping**: All commands use `wrapCommand()` for consistent error handling.

### Data Flow

1. User clicks "Sync from Code" → `@watchapi/parsers` detects routes
2. Routes converted to endpoints with `externalId` (stable identifier)
3. Endpoints stored in collection (local or cloud based on auth state)
4. TreeDataProvider refreshes sidebar
5. User opens endpoint → virtual filesystem serves .http content
6. Execute request → `got` library makes HTTP call → response rendered

## Configuration

VS Code settings:
- `watchapi.apiUrl` - Backend API URL
- `watchapi.dashboardUrl` - Dashboard URL
- `watchapi.includeAuthorizationHeader` - Include auth headers

Environment variables defined in `rest-client.env.json` at workspace root.

## Build System

- **Bundler**: esbuild (configured in `esbuild.js`)
- **Output**: Single `dist/extension.js` bundle (CommonJS)
- **External**: `vscode` module excluded from bundle
