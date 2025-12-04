import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { SseEvent } from '@observer/shared'

// Store active connections per workspace
const connections = new Map<number, Set<(event: SseEvent) => void>>()

// Broadcast an event to all connections for a workspace
export function broadcast(workspaceId: number, event: SseEvent) {
  const workspaceConnections = connections.get(workspaceId)
  console.log(`[SSE] Broadcasting to workspace ${workspaceId}:`, event.type, `(${workspaceConnections?.size || 0} connections)`)
  if (workspaceConnections) {
    for (const send of workspaceConnections) {
      try {
        send(event)
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

  // Note: In a full implementation, you'd verify auth via cookie/token
  // For now, we rely on the frontend only connecting after auth

  return streamSSE(c, async (stream) => {
    // Create send function
    const send = (event: SseEvent) => {
      stream.writeSSE({
        data: JSON.stringify(event),
        event: event.type,
      })
    }

    // Add connection to workspace
    if (!connections.has(workspaceId)) {
      connections.set(workspaceId, new Set())
    }
    connections.get(workspaceId)!.add(send)

    // Send connected event
    send({ type: 'connected', workspaceId })

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
      connections.get(workspaceId)?.delete(send)
    }
  })
})

export default sse
