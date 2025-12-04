import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { db, schema } from '../db/client'
import { eq } from 'drizzle-orm'
import { loginSchema, registerSchema } from '@observer/shared'
import { hashPassword, verifyPassword, generateToken, generateSlug, getSessionExpiry } from '../lib/utils'
import { requireAuth, type AuthContext } from '../middleware/auth'
import type { WorkspaceWithRole } from '@observer/shared'

const auth = new Hono<AuthContext>()

// Register new user
auth.post('/register', async (c) => {
  const body = await c.req.json()
  const result = registerSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const { email, password, name } = result.data

  // Check if email already exists
  const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get()

  if (existing) {
    return c.json({ error: 'Email already registered' }, 400)
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Create user
  const userResult = db
    .insert(schema.users)
    .values({
      email,
      passwordHash,
      name,
    })
    .returning()
    .get()

  // Create personal workspace for new user
  const workspaceSlug = generateSlug(`${name}-workspace`)
  const workspaceResult = db
    .insert(schema.workspaces)
    .values({
      name: `${name}'s Workspace`,
      slug: workspaceSlug,
    })
    .returning()
    .get()

  // Add user as owner of workspace
  db.insert(schema.workspaceMembers).values({
    workspaceId: workspaceResult.id,
    userId: userResult.id,
    role: 'owner',
  }).run()

  // Create default settings for workspace
  db.insert(schema.settings).values({
    workspaceId: workspaceResult.id,
  }).run()

  // Create session
  const sessionId = generateToken()
  db.insert(schema.sessions).values({
    id: sessionId,
    userId: userResult.id,
    expiresAt: getSessionExpiry(),
  }).run()

  // Set session cookie
  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  })

  // Return user and workspaces
  const workspaces: WorkspaceWithRole[] = [
    {
      id: workspaceResult.id,
      name: workspaceResult.name,
      slug: workspaceResult.slug,
      createdAt: workspaceResult.createdAt,
      role: 'owner',
    },
  ]

  return c.json({
    user: {
      id: userResult.id,
      email: userResult.email,
      name: userResult.name,
      avatarUrl: userResult.avatarUrl,
      createdAt: userResult.createdAt,
    },
    workspaces,
  })
})

// Login
auth.post('/login', async (c) => {
  const body = await c.req.json()
  const result = loginSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const { email, password } = result.data

  // Find user
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get()

  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Verify password
  const valid = await verifyPassword(user.passwordHash, password)

  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Create session
  const sessionId = generateToken()
  db.insert(schema.sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: getSessionExpiry(),
  }).run()

  // Set session cookie
  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  // Get user's workspaces
  const memberships = db
    .select({
      workspace: schema.workspaces,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaceMembers.workspaceId, schema.workspaces.id))
    .where(eq(schema.workspaceMembers.userId, user.id))
    .all()

  const workspaces: WorkspaceWithRole[] = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    createdAt: m.workspace.createdAt,
    role: m.role,
  }))

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    workspaces,
  })
})

// Logout
auth.post('/logout', requireAuth, (c) => {
  const sessionId = c.get('sessionId')

  // Delete session from database
  db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()

  // Clear cookie
  deleteCookie(c, 'session', { path: '/' })

  return c.json({ success: true })
})

// Get current user
auth.get('/me', requireAuth, (c) => {
  const user = c.get('user')

  // Get user's workspaces
  const memberships = db
    .select({
      workspace: schema.workspaces,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaceMembers.workspaceId, schema.workspaces.id))
    .where(eq(schema.workspaceMembers.userId, user.id))
    .all()

  const workspaces: WorkspaceWithRole[] = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    createdAt: m.workspace.createdAt,
    role: m.role,
  }))

  return c.json({ user, workspaces })
})

export default auth
