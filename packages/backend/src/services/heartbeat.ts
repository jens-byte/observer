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

async function sendPing(url: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      await fetch(url, { method: 'HEAD', signal: controller.signal })
      clearTimeout(timeoutId)
      return // Success
    } catch (error) {
      if (attempt === retries) {
        console.error(`Heartbeat ping failed after ${retries} attempts:`, (error as Error).message)
      } else {
        // Wait 5 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }
}
