import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { db, schema } from '../db/client'
import { eq, and, gt } from 'drizzle-orm'
import type { User, WorkspaceRole } from '@observer/shared'

// Extended context with user info
export type AuthContext = {
  Variables: {
    user: User
    sessionId: string
  }
}

// Extended context with workspace info
export type WorkspaceContext = AuthContext & {
  Variables: {
    user: User
    sessionId: string
    workspaceId: number
    workspaceRole: WorkspaceRole
  }
}

// Require authenticated user
export const requireAuth = createMiddleware<AuthContext>(async (c, next) => {
  const sessionId = getCookie(c, 'session')

  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Get session and check expiry
  const session = db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, new Date().toISOString())))
    .get()

  if (!session) {
    return c.json({ error: 'Session expired' }, 401)
  }

  // Get user
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get()

  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  // Set context
  c.set('user', {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  })
  c.set('sessionId', sessionId)

  await next()
})

// Require workspace membership with minimum role
export function requireWorkspace(minRole: WorkspaceRole = 'guest') {
  return createMiddleware<WorkspaceContext>(async (c, next) => {
    const sessionId = getCookie(c, 'session')

    if (!sessionId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Get session
    const session = db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, new Date().toISOString())))
      .get()

    if (!session) {
      return c.json({ error: 'Session expired' }, 401)
    }

    // Get user
    const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get()

    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    // Get workspace ID from route params
    const workspaceId = parseInt(c.req.param('workspaceId') || '', 10)

    if (!workspaceId || isNaN(workspaceId)) {
      return c.json({ error: 'Workspace ID required' }, 400)
    }

    // Check membership
    const membership = db
      .select()
      .from(schema.workspaceMembers)
      .where(
        and(eq(schema.workspaceMembers.workspaceId, workspaceId), eq(schema.workspaceMembers.userId, user.id))
      )
      .get()

    if (!membership) {
      return c.json({ error: 'Not a member of this workspace' }, 403)
    }

    // Check role hierarchy
    const roleHierarchy: Record<WorkspaceRole, number> = {
      owner: 3,
      editor: 2,
      guest: 1,
    }

    if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    // Set context
    c.set('user', {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    })
    c.set('sessionId', sessionId)
    c.set('workspaceId', workspaceId)
    c.set('workspaceRole', membership.role)

    await next()
  })
}

// Helper to check if user has required role
export function hasMinRole(userRole: WorkspaceRole, requiredRole: WorkspaceRole): boolean {
  const roleHierarchy: Record<WorkspaceRole, number> = {
    owner: 3,
    editor: 2,
    guest: 1,
  }
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}
