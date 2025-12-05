import type { SseEvent, SseCheckEvent, SseSiteUpdateEvent, SsePresenceEvent, PresenceUser } from '@observer/shared'

type EventCallback = (event: SseEvent) => void
type PresenceCallback = (users: PresenceUser[]) => void

class SSEClient {
  private eventSource: EventSource | null = null
  private workspaceId: number | null = null
  private callbacks: Set<EventCallback> = new Set()
  private presenceCallbacks: Set<PresenceCallback> = new Set()
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000

  connect(workspaceId: number) {
    // Don't reconnect if already connected to the same workspace
    if (this.eventSource && this.workspaceId === workspaceId) {
      return
    }

    // Disconnect from previous workspace
    this.disconnect()

    this.workspaceId = workspaceId
    const url = `/api/sse/events/${workspaceId}`

    try {
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = () => {
        console.log('[SSE] Connected to workspace', workspaceId)
        this.reconnectDelay = 1000
      }

      this.eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error)
        this.scheduleReconnect()
      }

      // Listen for specific event types
      this.eventSource.addEventListener('connected', (e) => {
        const data: SseEvent = {
          type: 'connected',
          workspaceId: JSON.parse(e.data).workspaceId,
        }
        this.notifyCallbacks(data)
      })

      this.eventSource.addEventListener('check', (e) => {
        console.log('[SSE] Raw check event data:', e.data)
        const parsed = JSON.parse(e.data) as SseCheckEvent
        console.log('[SSE] Parsed check event:', parsed)
        this.notifyCallbacks(parsed)
      })

      this.eventSource.addEventListener('site-update', (e) => {
        const parsed = JSON.parse(e.data) as SseSiteUpdateEvent
        this.notifyCallbacks(parsed)
      })

      this.eventSource.addEventListener('presence', (e) => {
        const parsed = JSON.parse(e.data) as SsePresenceEvent
        this.notifyPresenceCallbacks(parsed.users)
      })

      this.eventSource.addEventListener('heartbeat', () => {
        // Just keep-alive, no action needed
      })
    } catch (error) {
      console.error('[SSE] Failed to connect:', error)
      this.scheduleReconnect()
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    this.workspaceId = null
  }

  subscribe(callback: EventCallback) {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  subscribePresence(callback: PresenceCallback) {
    this.presenceCallbacks.add(callback)
    return () => {
      this.presenceCallbacks.delete(callback)
    }
  }

  private notifyPresenceCallbacks(users: PresenceUser[]) {
    for (const callback of this.presenceCallbacks) {
      try {
        callback(users)
      } catch (error) {
        console.error('[SSE] Presence callback error:', error)
      }
    }
  }

  private notifyCallbacks(event: SseEvent) {
    for (const callback of this.callbacks) {
      try {
        callback(event)
      } catch (error) {
        console.error('[SSE] Callback error:', error)
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      return
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    console.log(`[SSE] Reconnecting in ${this.reconnectDelay}ms...`)

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      if (this.workspaceId) {
        this.connect(this.workspaceId)
      }
    }, this.reconnectDelay)

    // Exponential backoff with max of 30 seconds
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
  }
}

// Singleton instance
export const sseClient = new SSEClient()
