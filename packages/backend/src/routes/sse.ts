import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { streamSSE } from 'hono/streaming'
import { db, schema } from '../db/client'
import { eq, and, gt } from 'drizzle-orm'
import type { SseEvent, PresenceUser, SsePresenceEvent } from '@observer/shared'

// Connection info with user data
interface ConnectionInfo {
  send: (event: SseEvent) => void
  user: PresenceUser
}

// Store active connections per workspace
const connections = new Map<number, Map<string, ConnectionInfo>>()

// Get current users in a workspace (deduplicated by user id)
function getWorkspaceUsers(workspaceId: number): PresenceUser[] {
  const workspaceConnections = connections.get(workspaceId)
  if (!workspaceConnections) return []

  const userMap = new Map<number, PresenceUser>()
  for (const conn of workspaceConnections.values()) {
    userMap.set(conn.user.id, conn.user)
  }
  return Array.from(userMap.values())
}

// Broadcast presence update to all users in workspace
function broadcastPresence(workspaceId: number) {
  const workspaceConnections = connections.get(workspaceId)
  if (!workspaceConnections) return

  const users = getWorkspaceUsers(workspaceId)
  const event: SsePresenceEvent = { type: 'presence', users }

  for (const conn of workspaceConnections.values()) {
    try {
      conn.send(event)
    } catch {
      // Connection might be closed
    }
  }
}

// Broadcast an event to all connections for a workspace
export function broadcast(workspaceId: number, event: SseEvent) {
  const workspaceConnections = connections.get(workspaceId)
  console.log(`[SSE] Broadcasting to workspace ${workspaceId}:`, event.type, `(${workspaceConnections?.size || 0} connections)`)
  if (workspaceConnections) {
    for (const conn of workspaceConnections.values()) {
      try {
        conn.send(event)
      } catch {
        // Connection might be closed
      }
    }
  }
}

// Create the SSE router
const sse = new Hono()

sse.get('/events/:workspaceId', async (c) => {
  const workspaceId = Number(c.req.param('workspaceId'))

  // Verify auth via session cookie
  const sessionId = getCookie(c, 'session')
  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const session = db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, new Date().toISOString())))
    .get()

  if (!session) {
    return c.json({ error: 'Session expired' }, 401)
  }

  const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get()
  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  // Check if user is a member of the workspace
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

  // Create a unique connection ID
  const connectionId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  // One-hour max lifetime forces clients to reconnect periodically so leaked
  // server-side connections can't accumulate indefinitely.
  const MAX_CONNECTION_MS = 60 * 60 * 1000
  const abortSignal = c.req.raw.signal

  return streamSSE(c, async (stream) => {
    const send = (event: SseEvent) => {
      stream.writeSSE({
        data: JSON.stringify(event),
        event: event.type,
      })
    }

    const connectionInfo: ConnectionInfo = {
      send,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    }

    if (!connections.has(workspaceId)) {
      connections.set(workspaceId, new Map())
    }
    connections.get(workspaceId)!.set(connectionId, connectionInfo)

    send({ type: 'connected', workspaceId })
    broadcastPresence(workspaceId)

    const heartbeatInterval = setInterval(() => {
      stream.writeSSE({ data: 'heartbeat', event: 'heartbeat' }).catch(() => {})
    }, 30000)

    try {
      // Exit on any of: client disconnect (abort), stream close, or max lifetime.
      await new Promise<void>((resolve) => {
        let poll: ReturnType<typeof setInterval> | null = null
        let maxAge: ReturnType<typeof setTimeout> | null = null
        const done = () => {
          if (poll) clearInterval(poll)
          if (maxAge) clearTimeout(maxAge)
          resolve()
        }
        if (abortSignal.aborted || stream.closed) return done()
        abortSignal.addEventListener('abort', done, { once: true })
        poll = setInterval(() => {
          if (stream.closed) done()
        }, 1000)
        maxAge = setTimeout(done, MAX_CONNECTION_MS)
      })
    } finally {
      clearInterval(heartbeatInterval)
      connections.get(workspaceId)?.delete(connectionId)
      broadcastPresence(workspaceId)
    }
  })
})

export default sse
