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

  return streamSSE(c, async (stream) => {
    // Create send function
    const send = (event: SseEvent) => {
      stream.writeSSE({
        data: JSON.stringify(event),
        event: event.type,
      })
    }

    // Create connection info
    const connectionInfo: ConnectionInfo = {
      send,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    }

    // Add connection to workspace
    if (!connections.has(workspaceId)) {
      connections.set(workspaceId, new Map())
    }
    connections.get(workspaceId)!.set(connectionId, connectionInfo)

    // Send connected event
    send({ type: 'connected', workspaceId })

    // Broadcast presence update to all users (including the new one)
    broadcastPresence(workspaceId)

    // Keep connection alive with periodic heartbeats
    const heartbeatInterval = setInterval(() => {
      try {
        stream.writeSSE({ data: 'heartbeat', event: 'heartbeat' })
      } catch {
        clearInterval(heartbeatInterval)
      }
    }, 30000)

    // Wait for connection to close
    try {
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        // Check if stream is still writable
        if (stream.closed) break
      }
    } catch {
      // Connection closed
    } finally {
      clearInterval(heartbeatInterval)
      connections.get(workspaceId)?.delete(connectionId)
      // Broadcast updated presence after user disconnects
      broadcastPresence(workspaceId)
    }
  })
})

export default sse
