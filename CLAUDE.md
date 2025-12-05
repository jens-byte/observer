# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Observer is a website monitoring application that tracks uptime, SSL certificates, DNS, and response times. It features multi-tenant workspaces with role-based access control.

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono (web framework), Drizzle ORM, SQLite, Playwright (screenshots)
- **Frontend**: SolidJS, Tailwind CSS v4, Vite
- **Shared**: Zod schemas and TypeScript types
- **Deployment**: Docker, GitHub Actions (manual trigger only)

## Development Commands

```bash
# Install dependencies
bun install

# Run both frontend and backend in dev mode
bun run dev

# Run only backend (port 3001)
bun run dev:backend

# Run only frontend (port 5173)
bun run dev:frontend

# Build all packages
bun run build

# Lint and format
bun run lint
bun run lint:fix
bun run format

# Type checking
bun run typecheck

# Database commands (from packages/backend)
bun run db:generate  # Generate migration from schema changes
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
```

## Architecture

### Monorepo Structure

```
packages/
├── backend/     # @observer/backend - Hono API server
├── frontend/    # @observer/frontend - SolidJS SPA
└── shared/      # @observer/shared - Types and Zod schemas
```

### Backend Services

- `services/monitor.ts` - Site check scheduler (runs every 60s)
- `services/notifier.ts` - Slack/email/webhook notifications
- `services/ssl-checker.ts` - SSL certificate verification
- `services/dns-checker.ts` - DNS/nameserver lookup
- `services/screenshot.ts` - Playwright screenshots for alerts
- `services/email.ts` - SMTP email sending via nodemailer

### API Routes

All API routes are prefixed with `/api/`:
- `/api/auth/*` - Authentication (login, register, logout, me)
- `/api/workspaces/*` - Workspace CRUD and members
- `/api/workspaces/:id/sites/*` - Sites CRUD for a workspace
- `/api/workspaces/:id/settings/*` - Workspace notification settings
- `/api/sse/events/:workspaceId` - Server-Sent Events for real-time updates

### Database

SQLite database with Drizzle ORM. Schema in `packages/backend/src/db/schema.ts`.

Key tables: `users`, `workspaces`, `workspace_members`, `workspace_invites`, `sites`, `checks`, `settings`, `ssl_info`, `dns_info`

Production database path: `/app/data/observer.db` (set via `DATABASE_PATH` env var)

### Frontend State

- Auth state managed via `lib/auth.tsx` context
- Theme (light/dark) managed via `lib/theme.tsx` context
- API calls in `lib/api.ts`
- Real-time updates via SSE in Dashboard component

## Deployment

Manual deployment via GitHub Actions:
```bash
gh workflow run deploy.yml
```

Server: `observer.megavisor.be` - Runs Docker container with volume for SQLite persistence.

## Key Patterns

### Authentication & Authorization

- `requireAuth` middleware validates session cookies and sets `c.get('user')`
- `requireWorkspace(minRole)` middleware checks workspace membership with role hierarchy:
  - `owner` (3) > `editor` (2) > `guest` (1)
- Password hashing uses Argon2 (`@node-rs/argon2`)
- Session cookies are httpOnly with 30-day expiry

### Cross-Package Imports

Types and schemas are shared via `@observer/shared`:
```typescript
import type { User, Site, SiteWithDetails } from '@observer/shared'
import { createSiteSchema } from '@observer/shared'
```

### SSE Real-time Updates

- `broadcast(workspaceId, event)` from `routes/sse.ts` sends events to all connected clients
- Event types: `check`, `site-update`, `connected`
- Frontend subscribes via `EventSource` to `/api/sse/events/:workspaceId`

### Monitor Service

- Checks run every 60 seconds via scheduler
- Sites processed in batches of 5 with 500ms delay
- Down status requires 2 consecutive failures before notification
- SSL/DNS checks run after each uptime check

## Environment Variables

- `DATABASE_PATH` - SQLite database location (default: `./observer.db`, prod: `/app/data/observer.db`)
- `PORT` - Backend server port (default: 3001)
