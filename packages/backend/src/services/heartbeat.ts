/**
 * Heartbeat service - pings an external monitoring service (e.g., healthchecks.io)
 * to alert when Observer itself goes down.
 */

export function startHeartbeat(intervalMs: number) {
  const url = process.env.HEARTBEAT_URL
  if (!url) {
    console.log('⏭️  Heartbeat disabled (HEARTBEAT_URL not set)')
    return
  }

  console.log('💓 Heartbeat started')

  // Send initial ping
  sendPing(url)

  // Then ping on interval
  setInterval(() => sendPing(url), intervalMs)
}

async function sendPing(url: string) {
  try {
    await fetch(url, { method: 'HEAD' })
  } catch (error) {
    console.error('Heartbeat ping failed:', error)
  }
}
