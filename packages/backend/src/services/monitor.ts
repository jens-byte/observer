import { db, schema } from '../db/client'
import { eq, and, sql, desc } from 'drizzle-orm'
import { checkSSL } from './ssl-checker'
import { checkDNS } from './dns-checker'
import { broadcast } from '../routes/sse'
import { sendNotification } from './notifier'
import { captureScreenshot, diagnoseProblem } from './screenshot'

const TIMEOUT = 60000 // 60 seconds
const MAX_RETRIES = 5
const RETRY_DELAY = 5000 // 5 seconds between retries
const CONSECUTIVE_FAILURES_THRESHOLD = 2

interface FetchResult {
  success: boolean
  response?: Response
  responseTime?: number
  error?: Error
}

// Force IPv4 fetch with retries
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<FetchResult> {
  let lastError: Error | null = null
  const startTime = Date.now()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      return { success: true, response, responseTime }
    } catch (error) {
      lastError = error as Error
      console.log(`[Monitor] ${url} attempt ${attempt}/${retries} failed: ${lastError.message}`)

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
      }
    }
  }

  return { success: false, error: lastError!, responseTime: Date.now() - startTime }
}

export async function checkSite(siteId: number): Promise<{
  status: string
  statusCode: number | null
  responseTime: number | null
  errorMessage: string | null
}> {
  const site = db.select().from(schema.sites).where(eq(schema.sites.id, siteId)).get()

  if (!site) {
    throw new Error('Site not found')
  }

  let status = 'up'
  let statusCode: number | null = null
  let errorMessage: string | null = null
  let responseTime: number | null = null

  const result = await fetchWithRetry(site.url)

  if (result.success && result.response) {
    responseTime = result.responseTime!
    statusCode = result.response.status

    if (statusCode >= 400) {
      status = 'down'
      errorMessage = `HTTP ${statusCode}`
    }
  } else {
    responseTime = result.responseTime!
    status = 'down'
    errorMessage = result.error?.message || 'Unknown error'
  }

  // Get previous check for slow detection
  const lastCheck = db
    .select()
    .from(schema.checks)
    .where(eq(schema.checks.siteId, siteId))
    .orderBy(desc(schema.checks.checkedAt))
    .limit(1)
    .get()

  // Calculate rolling average for slow detection (last 20 checks, excluding slow ones)
  const avgResult = db
    .select({
      avgTime: sql<number>`AVG(response_time)`,
      checkCount: sql<number>`COUNT(*)`,
    })
    .from(schema.checks)
    .where(
      and(
        eq(schema.checks.siteId, siteId),
        sql`response_time IS NOT NULL`,
        eq(schema.checks.isSlow, false)
      )
    )
    .get()

  const avgTime = avgResult?.avgTime || 0
  const checkCount = avgResult?.checkCount || 0

  // Determine if current check is slow (response > 5x average AND > 10000ms)
  const isCurrentCheckSlow =
    status === 'up' && checkCount >= 5 && avgTime > 0 && responseTime! > avgTime * 5 && responseTime! > 10000

  // For slow status: require 3 consecutive fast checks to recover
  let isSlow = isCurrentCheckSlow
  if (lastCheck?.isSlow && !isCurrentCheckSlow) {
    const recentChecks = db
      .select({ responseTime: schema.checks.responseTime })
      .from(schema.checks)
      .where(and(eq(schema.checks.siteId, siteId), eq(schema.checks.status, 'up')))
      .orderBy(desc(schema.checks.checkedAt))
      .limit(2)
      .all()

    const allFast = recentChecks.length >= 2 && recentChecks.every((c) => c.responseTime! <= avgTime * 5)
    isSlow = !allFast
  }

  // Store check result
  db.insert(schema.checks).values({
    siteId,
    status,
    responseTime,
    statusCode,
    errorMessage,
    isSlow,
  }).run()

  // Update cached values on sites table
  const now = new Date().toISOString()

  // Calculate uptime (last 30 days)
  const uptimeStats = db
    .select({
      total: sql<number>`COUNT(*)`,
      upCount: sql<number>`SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)`,
    })
    .from(schema.checks)
    .where(and(eq(schema.checks.siteId, siteId), sql`checked_at >= datetime('now', '-30 days')`))
    .get()

  const uptime =
    uptimeStats && uptimeStats.total > 0
      ? ((uptimeStats.upCount / uptimeStats.total) * 100).toFixed(2)
      : null

  db.update(schema.sites)
    .set({
      lastStatus: status,
      lastResponseTime: responseTime,
      lastCheckedAt: now,
      cachedIsSlow: isSlow,
      cachedUptime: uptime,
    })
    .where(eq(schema.sites.id, siteId))
    .run()

  // Handle down/up notification logic
  await handleDownNotification(site, status, errorMessage, statusCode)

  // Check SSL if HTTPS
  if (site.url.startsWith('https://')) {
    try {
      await checkSSL(siteId, site.url)
    } catch (error) {
      console.error(`SSL check failed for ${site.url}:`, (error as Error).message)
    }
  }

  // Check DNS
  try {
    await checkDNS(siteId, site.url)
  } catch (error) {
    console.error(`DNS check failed for ${site.url}:`, (error as Error).message)
  }

  // Broadcast SSE event
  broadcast(site.workspaceId, {
    type: 'check',
    siteId,
    status: status as 'up' | 'down' | 'unknown',
    responseTime,
    isSlow,
  })

  return { status, statusCode, responseTime, errorMessage }
}

async function handleDownNotification(
  site: typeof schema.sites.$inferSelect,
  status: string,
  errorMessage: string | null,
  statusCode: number | null
) {
  // Get current state
  const currentState = db
    .select({
      consecutiveFailures: schema.sites.consecutiveFailures,
      confirmedDownAt: schema.sites.confirmedDownAt,
      downNotified: schema.sites.downNotified,
    })
    .from(schema.sites)
    .where(eq(schema.sites.id, site.id))
    .get()

  if (!currentState) return

  let { consecutiveFailures, confirmedDownAt, downNotified } = currentState

  if (status === 'down') {
    consecutiveFailures++

    const isConfirmedDown = consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD

    if (isConfirmedDown && !confirmedDownAt) {
      confirmedDownAt = new Date().toISOString()
      console.log(`[Monitor] ${site.name} confirmed DOWN after ${consecutiveFailures} consecutive failures`)
    }

    db.update(schema.sites)
      .set({ consecutiveFailures, confirmedDownAt })
      .where(eq(schema.sites.id, site.id))
      .run()

    // Check if we should send notification
    if (isConfirmedDown && !downNotified) {
      const settings = db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.workspaceId, site.workspaceId))
        .get()

      if (settings) {
        const delayMs = (settings.webhookDelaySeconds || 0) * 1000
        const confirmedDownTime = new Date(confirmedDownAt!).getTime()
        const downtime = Date.now() - confirmedDownTime

        if (downtime >= delayMs) {
          // Diagnose the problem
          const diagnosis = diagnoseProblem(errorMessage, statusCode)

          // Capture screenshot (async, don't block notification)
          let screenshotBuffer: Buffer | null = null
          try {
            console.log(`[Monitor] Capturing screenshot for ${site.name}...`)
            screenshotBuffer = await captureScreenshot(site.url)
            if (screenshotBuffer) {
              console.log(`[Monitor] Screenshot captured for ${site.name}`)
            }
          } catch (error) {
            console.error(`[Monitor] Screenshot failed for ${site.name}:`, (error as Error).message)
          }

          // Send notification with screenshot and diagnosis
          sendNotification(site.workspaceId, {
            siteName: site.name,
            siteUrl: site.url,
            status: 'down',
            errorMessage: errorMessage || undefined,
            statusCode: statusCode || undefined,
            diagnosis,
          }, screenshotBuffer || undefined).catch(console.error)

          db.update(schema.sites).set({ downNotified: true }).where(eq(schema.sites.id, site.id)).run()
        }
      }
    }
  } else if (status === 'up') {
    if (downNotified) {
      const downtimeMs = confirmedDownAt ? Date.now() - new Date(confirmedDownAt).getTime() : null
      // Send recovery notification
      sendNotification(site.workspaceId, {
        siteName: site.name,
        siteUrl: site.url,
        status: 'up',
        downtime: downtimeMs ? Math.round(downtimeMs / 1000) : undefined,
      }).catch(console.error)
    }

    // Reset state
    db.update(schema.sites)
      .set({
        consecutiveFailures: 0,
        confirmedDownAt: null,
        downNotified: false,
      })
      .where(eq(schema.sites.id, site.id))
      .run()
  }
}

// Process sites in batches
async function processBatches<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<void>,
  delayMs = 0
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(processor))

    if (delayMs > 0 && i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export async function checkAllSites() {
  const sites = db.select().from(schema.sites).where(eq(schema.sites.isActive, true)).all()

  // Filter sites that are due for checking
  const sitesToCheck = sites.filter((site) => {
    const lastCheck = db
      .select({ checkedAt: schema.checks.checkedAt })
      .from(schema.checks)
      .where(eq(schema.checks.siteId, site.id))
      .orderBy(desc(schema.checks.checkedAt))
      .limit(1)
      .get()

    if (lastCheck) {
      const lastCheckTime = new Date(lastCheck.checkedAt).getTime()
      const intervalMs = site.checkInterval * 60 * 1000
      if (Date.now() - lastCheckTime < intervalMs) {
        return false
      }
    }
    return true
  })

  if (sitesToCheck.length > 0) {
    console.log(`[Scheduler] Checking ${sitesToCheck.length} sites in batches of 5...`)
  }

  // Process sites in batches of 5 with 500ms delay
  await processBatches(
    sitesToCheck,
    5,
    async (site) => {
      try {
        await checkSite(site.id)
      } catch (error) {
        console.error(`Error checking site ${site.name}:`, (error as Error).message)
      }
    },
    500
  )
}

// Start scheduler
let schedulerInterval: Timer | null = null

export function startScheduler(intervalMs = 60000) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
  }

  console.log(`[Scheduler] Starting with ${intervalMs}ms interval`)

  // Run immediately
  checkAllSites().catch(console.error)

  // Then run on interval
  schedulerInterval = setInterval(() => {
    checkAllSites().catch(console.error)
  }, intervalMs)
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[Scheduler] Stopped')
  }
}
