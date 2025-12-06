import { Hono } from 'hono'
import { db, schema } from '../db/client'
import { eq, and } from 'drizzle-orm'
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '@observer/shared'
import type { WorkspaceWithRole, WorkspaceMember, WorkspaceInvite } from '@observer/shared'
import { requireAuth, requireWorkspace, hasMinRole, type AuthContext, type WorkspaceContext } from '../middleware/auth'
import { generateToken, generateSlug, getInviteExpiry } from '../lib/utils'
import { sendInviteEmail } from '../services/email'

const workspaces = new Hono<AuthContext>()

// List user's workspaces
workspaces.get('/', requireAuth, (c) => {
  const user = c.get('user')

  const memberships = db
    .select({
      workspace: schema.workspaces,
      role: schema.workspaceMembers.role,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaceMembers.workspaceId, schema.workspaces.id))
    .where(eq(schema.workspaceMembers.userId, user.id))
    .all()

  const result: WorkspaceWithRole[] = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    createdAt: m.workspace.createdAt,
    role: m.role,
  }))

  return c.json(result)
})

// Create workspace
workspaces.post('/', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const result = createWorkspaceSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const { name, slug } = result.data

  // Check slug uniqueness
  const existing = db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, slug)).get()
  if (existing) {
    return c.json({ error: 'Workspace slug already exists' }, 400)
  }

  // Create workspace
  const workspace = db
    .insert(schema.workspaces)
    .values({ name, slug })
    .returning()
    .get()

  // Add creator as owner
  db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
  }).run()

  // Create default settings
  db.insert(schema.settings).values({
    workspaceId: workspace.id,
  }).run()

  return c.json({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt,
    role: 'owner' as const,
  })
})

// Get workspace details
workspaces.get('/:workspaceId', requireWorkspace('guest'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const role = c.get('workspaceRole')

  const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get()

  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }

  return c.json({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt,
    role,
  })
})

// Update workspace
workspaces.put('/:workspaceId', requireWorkspace('owner'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const body = await c.req.json()
  const result = updateWorkspaceSchema.safeParse(body)

  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const { name, slug } = result.data

  // Check slug uniqueness if changing
  if (slug) {
    const existing = db
      .select()
      .from(schema.workspaces)
      .where(and(eq(schema.workspaces.slug, slug), eq(schema.workspaces.id, workspaceId)))
      .get()
    if (existing && existing.id !== workspaceId) {
      return c.json({ error: 'Workspace slug already exists' }, 400)
    }
  }

  // Build update object
  const updates: Record<string, string> = {}
  if (name) updates.name = name
  if (slug) updates.slug = slug

  if (Object.keys(updates).length > 0) {
    db.update(schema.workspaces).set(updates).where(eq(schema.workspaces.id, workspaceId)).run()
  }

  const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get()

  return c.json({
    id: workspace!.id,
    name: workspace!.name,
    slug: workspace!.slug,
    createdAt: workspace!.createdAt,
    role: 'owner' as const,
  })
})

// Delete workspace
workspaces.delete('/:workspaceId', requireWorkspace('owner'), (c: any) => {
  const workspaceId = c.get('workspaceId')

  db.delete(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).run()

  return c.json({ success: true })
})

// List workspace members
workspaces.get('/:workspaceId/members', requireWorkspace('guest'), (c: any) => {
  const workspaceId = c.get('workspaceId')

  const members = db
    .select({
      id: schema.workspaceMembers.id,
      workspaceId: schema.workspaceMembers.workspaceId,
      userId: schema.workspaceMembers.userId,
      role: schema.workspaceMembers.role,
      invitedBy: schema.workspaceMembers.invitedBy,
      joinedAt: schema.workspaceMembers.joinedAt,
      user: {
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        avatarUrl: schema.users.avatarUrl,
        createdAt: schema.users.createdAt,
      },
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.users, eq(schema.workspaceMembers.userId, schema.users.id))
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId))
    .all()

  return c.json(members)
})

// Invite member
workspaces.post('/:workspaceId/invite', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const userRole = c.get('workspaceRole')
  const body = await c.req.json()

  const result = inviteMemberSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const { email, role } = result.data

  // Editors can only invite guests
  if (userRole === 'editor' && role !== 'guest') {
    return c.json({ error: 'Editors can only invite guests' }, 403)
  }

  // Check if user already exists in the system
  const existingUser = db.select().from(schema.users).where(eq(schema.users.email, email)).get()
  if (existingUser) {
    // Check if already a member
    const existingMember = db
      .select()
      .from(schema.workspaceMembers)
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, workspaceId),
          eq(schema.workspaceMembers.userId, existingUser.id)
        )
      )
      .get()
    if (existingMember) {
      return c.json({ error: 'User is already a member' }, 400)
    }

    // User exists but not a member - add them directly
    db.insert(schema.workspaceMembers).values({
      workspaceId,
      userId: existingUser.id,
      role,
      invitedBy: user.id,
    }).run()

    // Return success with added flag
    return c.json({
      added: true,
      email,
      role,
      message: 'User added to workspace',
    })
  }

  // User doesn't exist - create an invite for new user
  // Check for existing invite
  const existingInvite = db
    .select()
    .from(schema.workspaceInvites)
    .where(and(eq(schema.workspaceInvites.workspaceId, workspaceId), eq(schema.workspaceInvites.email, email)))
    .get()
  if (existingInvite) {
    return c.json({ error: 'Invite already pending for this email' }, 400)
  }

  // Create invite
  const token = generateToken()
  const invite = db
    .insert(schema.workspaceInvites)
    .values({
      workspaceId,
      email,
      role,
      token,
      invitedBy: user.id,
      expiresAt: getInviteExpiry(),
    })
    .returning()
    .get()

  // Get workspace name for email
  const workspace = db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .get()

  // Send invite email (don't wait, fire and forget)
  sendInviteEmail(email, token, workspace?.name || 'Observer', user.name, workspaceId).catch(err => {
    console.error('[Invite] Failed to send email:', err)
  })

  return c.json({
    id: invite.id,
    workspaceId: invite.workspaceId,
    email: invite.email,
    role: invite.role,
    token: invite.token,
    invitedBy: invite.invitedBy,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  })
})

// List pending invites
workspaces.get('/:workspaceId/invites', requireWorkspace('editor'), (c: any) => {
  const workspaceId = c.get('workspaceId')

  const invites = db
    .select()
    .from(schema.workspaceInvites)
    .where(eq(schema.workspaceInvites.workspaceId, workspaceId))
    .all()

  return c.json(invites)
})

// Cancel invite
workspaces.delete('/:workspaceId/invites/:inviteId', requireWorkspace('editor'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const inviteId = parseInt(c.req.param('inviteId'), 10)

  const invite = db
    .select()
    .from(schema.workspaceInvites)
    .where(and(eq(schema.workspaceInvites.id, inviteId), eq(schema.workspaceInvites.workspaceId, workspaceId)))
    .get()

  if (!invite) {
    return c.json({ error: 'Invite not found' }, 404)
  }

  db.delete(schema.workspaceInvites).where(eq(schema.workspaceInvites.id, inviteId)).run()

  return c.json({ success: true })
})

// Update member role
workspaces.put('/:workspaceId/members/:memberId', requireWorkspace('owner'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const memberId = parseInt(c.req.param('memberId'), 10)
  const body = await c.req.json()

  const result = updateMemberRoleSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const { role } = result.data

  // Can't change own role
  const user = c.get('user')
  const member = db
    .select()
    .from(schema.workspaceMembers)
    .where(and(eq(schema.workspaceMembers.id, memberId), eq(schema.workspaceMembers.workspaceId, workspaceId)))
    .get()

  if (!member) {
    return c.json({ error: 'Member not found' }, 404)
  }

  if (member.userId === user.id) {
    return c.json({ error: 'Cannot change your own role' }, 400)
  }

  db.update(schema.workspaceMembers)
    .set({ role })
    .where(eq(schema.workspaceMembers.id, memberId))
    .run()

  return c.json({ ...member, role })
})

// Remove member
workspaces.delete('/:workspaceId/members/:memberId', requireWorkspace('owner'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const memberId = parseInt(c.req.param('memberId'), 10)
  const user = c.get('user')

  const member = db
    .select()
    .from(schema.workspaceMembers)
    .where(and(eq(schema.workspaceMembers.id, memberId), eq(schema.workspaceMembers.workspaceId, workspaceId)))
    .get()

  if (!member) {
    return c.json({ error: 'Member not found' }, 404)
  }

  if (member.userId === user.id) {
    return c.json({ error: 'Cannot remove yourself' }, 400)
  }

  db.delete(schema.workspaceMembers).where(eq(schema.workspaceMembers.id, memberId)).run()

  return c.json({ success: true })
})

// Leave workspace
workspaces.post('/:workspaceId/leave', requireWorkspace('guest'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const user = c.get('user')
  const role = c.get('workspaceRole')

  // Owners cannot leave (must transfer ownership first)
  if (role === 'owner') {
    return c.json({ error: 'Owners cannot leave. Transfer ownership first.' }, 400)
  }

  db.delete(schema.workspaceMembers)
    .where(
      and(eq(schema.workspaceMembers.workspaceId, workspaceId), eq(schema.workspaceMembers.userId, user.id))
    )
    .run()

  return c.json({ success: true })
})

// Get workspace by slug (for URL navigation)
workspaces.get('/by-slug/:slug', requireAuth, (c) => {
  const user = c.get('user')
  const slug = c.req.param('slug')

  // Find workspace by slug
  const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, slug)).get()

  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }

  // Check if user is a member
  const membership = db
    .select()
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspace.id),
        eq(schema.workspaceMembers.userId, user.id)
      )
    )
    .get()

  if (!membership) {
    return c.json({ error: 'Not a member of this workspace' }, 403)
  }

  return c.json({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt,
    role: membership.role,
  })
})

export default workspaces

// Separate router for public invite acceptance
export const inviteRoutes = new Hono<AuthContext>()

// Accept invite (requires auth but not workspace membership)
inviteRoutes.post('/:token/accept', requireAuth, (c) => {
  const user = c.get('user')
  const token = c.req.param('token')

  const invite = db
    .select()
    .from(schema.workspaceInvites)
    .where(eq(schema.workspaceInvites.token, token))
    .get()

  if (!invite) {
    return c.json({ error: 'Invalid invite token' }, 404)
  }

  // Check expiry
  if (new Date(invite.expiresAt) < new Date()) {
    return c.json({ error: 'Invite has expired' }, 400)
  }

  // Check if user email matches invite email (or allow any authenticated user?)
  // For now, allow any authenticated user to accept

  // Check if already a member
  const existingMember = db
    .select()
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, invite.workspaceId),
        eq(schema.workspaceMembers.userId, user.id)
      )
    )
    .get()

  if (existingMember) {
    return c.json({ error: 'Already a member of this workspace' }, 400)
  }

  // Add user as member
  db.insert(schema.workspaceMembers).values({
    workspaceId: invite.workspaceId,
    userId: user.id,
    role: invite.role,
    invitedBy: invite.invitedBy,
  }).run()

  // Delete invite
  db.delete(schema.workspaceInvites).where(eq(schema.workspaceInvites.id, invite.id)).run()

  // Get workspace
  const workspace = db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, invite.workspaceId))
    .get()

  return c.json({
    workspace: {
      id: workspace!.id,
      name: workspace!.name,
      slug: workspace!.slug,
      createdAt: workspace!.createdAt,
      role: invite.role,
    },
  })
})
