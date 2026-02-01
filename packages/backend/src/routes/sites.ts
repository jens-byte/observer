import { Hono } from 'hono'
import { db, schema, sqlite } from '../db/client'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { createSiteSchema, updateSiteSchema, reorderSitesSchema } from '@observer/shared'
import type { SiteWithDetails } from '@observer/shared'
import { requireWorkspace, type WorkspaceContext } from '../middleware/auth'
import { generateToken } from '../lib/utils'
import { checkSite } from '../services/monitor'
import { broadcast } from './sse'

const sites = new Hono<WorkspaceContext>()

// Helper to get site with all details
function getSiteWithDetails(siteId: number): SiteWithDetails | null {
  const site = db.select().from(schema.sites).where(eq(schema.sites.id, siteId)).get()
  if (!site) return null

  // Get SSL info
  const ssl = db.select().from(schema.sslInfo).where(eq(schema.sslInfo.siteId, siteId)).get()

  // Get DNS info
  const dns = db.select().from(schema.dnsInfo).where(eq(schema.dnsInfo.siteId, siteId)).get()

  // Get CMS info
  const cms = db.select().from(schema.cmsInfo).where(eq(schema.cmsInfo.siteId, siteId)).get()

  // Get response history (last 20)
  const recentChecks = db
    .select({ responseTime: schema.checks.responseTime })
    .from(schema.checks)
    .where(and(eq(schema.checks.siteId, siteId), sql`${schema.checks.responseTime} IS NOT NULL`))
    .orderBy(desc(schema.checks.checkedAt))
    .limit(20)
    .all()

  const responseHistory = recentChecks.map((c) => c.responseTime!).reverse()

  return {
    id: site.id,
    workspaceId: site.workspaceId,
    name: site.name,
    url: site.url,
    checkInterval: site.checkInterval,
    isActive: site.isActive,
    isStarred: site.isStarred,
    isSla: site.isSla,
    license: site.license,
    lastStatus: site.lastStatus as any,
    lastResponseTime: site.lastResponseTime,
    lastCheckedAt: site.lastCheckedAt,
    consecutiveFailures: site.consecutiveFailures,
    confirmedDownAt: site.confirmedDownAt,
    downNotified: site.downNotified,
    createdAt: site.createdAt,
    isSlow: site.cachedIsSlow,
    uptime: site.cachedUptime ? parseFloat(site.cachedUptime) : null,
    responseHistory,
    sslDaysRemaining: ssl?.daysRemaining ?? null,
    sslValidTo: ssl?.validTo ?? null,
    nameservers: dns?.nameservers ?? null,
    ipAddress: dns?.ipAddress ?? null,
    cmsName: cms?.cmsName ?? null,
    cmsVersion: cms?.cmsVersion ?? null,
  }
}

// List sites for workspace
sites.get('/', requireWorkspace('guest'), (c: any) => {
  const start = Date.now()
  const workspaceId = c.get('workspaceId')

  const allSites = db
    .select()
    .from(schema.sites)
    .where(eq(schema.sites.workspaceId, workspaceId))
    .orderBy(desc(schema.sites.isStarred), schema.sites.sortOrder, desc(schema.sites.createdAt))
    .all()
  console.log(`[Sites API] sites query: ${Date.now() - start}ms`)

  // Get all site IDs
  const siteIds = allSites.map((s) => s.id)
  if (siteIds.length === 0) {
    return c.json([])
  }

  // Batch load related data for this workspace's sites only
  const t1 = Date.now()
  const sslData = db.select().from(schema.sslInfo).where(inArray(schema.sslInfo.siteId, siteIds)).all()
  const dnsData = db.select().from(schema.dnsInfo).where(inArray(schema.dnsInfo.siteId, siteIds)).all()
  const cmsData = db.select().from(schema.cmsInfo).where(inArray(schema.cmsInfo.siteId, siteIds)).all()
  console.log(`[Sites API] ssl/dns/cms queries: ${Date.now() - t1}ms`)

  // Build lookup maps
  const sslMap = new Map(sslData.map((s) => [s.siteId, s]))
  const dnsMap = new Map(dnsData.map((d) => [d.siteId, d]))
  const cmsMap = new Map(cmsData.map((c) => [c.siteId, c]))

  // Get recent response times (last 20 per site, ordered chronologically)
  const t2 = Date.now()
  const siteIdList = siteIds.join(',')
  // Order by ASC so we get chronological order directly, avoiding reverse()
  const responseHistories = sqlite
    .query<{ siteId: number; responseTime: number }, []>(`
      SELECT site_id as siteId, response_time as responseTime
      FROM (
        SELECT site_id, response_time, checked_at,
               ROW_NUMBER() OVER (PARTITION BY site_id ORDER BY checked_at DESC) as rn
        FROM checks
        WHERE site_id IN (${siteIdList})
          AND response_time IS NOT NULL
          AND checked_at >= datetime('now', '-30 minutes')
      )
      WHERE rn <= 20
      ORDER BY site_id, checked_at ASC
    `)
    .all()
  console.log(`[Sites API] response history query: ${Date.now() - t2}ms, rows: ${responseHistories.length}`)

  // Group by site (already in chronological order)
  const responseHistoryMap = new Map<number, number[]>()
  for (const r of responseHistories) {
    if (!responseHistoryMap.has(r.siteId)) {
      responseHistoryMap.set(r.siteId, [])
    }
    responseHistoryMap.get(r.siteId)!.push(r.responseTime)
  }
  console.log(`[Sites API] total: ${Date.now() - start}ms`)

  // Build response
  const result: SiteWithDetails[] = allSites.map((site) => {
    const ssl = sslMap.get(site.id)
    const dns = dnsMap.get(site.id)
    const cms = cmsMap.get(site.id)
    const history = responseHistoryMap.get(site.id) || []

    return {
      id: site.id,
      workspaceId: site.workspaceId,
      name: site.name,
      url: site.url,
      checkInterval: site.checkInterval,
      isActive: site.isActive,
      isStarred: site.isStarred,
      isSla: site.isSla,
      license: site.license,
      lastStatus: site.lastStatus as any,
      lastResponseTime: site.lastResponseTime,
      lastCheckedAt: site.lastCheckedAt,
      consecutiveFailures: site.consecutiveFailures,
      confirmedDownAt: site.confirmedDownAt,
      downNotified: site.downNotified,
      createdAt: site.createdAt,
      isSlow: site.cachedIsSlow,
      uptime: site.cachedUptime ? parseFloat(site.cachedUptime) : null,
      responseHistory: history,
      sslDaysRemaining: ssl?.daysRemaining ?? null,
      sslValidTo: ssl?.validTo ?? null,
      nameservers: dns?.nameservers ?? null,
      ipAddress: dns?.ipAddress ?? null,
      cmsName: cms?.cmsName ?? null,
      cmsVersion: cms?.cmsVersion ?? null,
    }
  })

  return c.json(result)
})

// Get single site
sites.get('/:siteId', requireWorkspace('guest'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const siteWithDetails = getSiteWithDetails(siteId)
  return c.json(siteWithDetails)
})

// Create site
sites.post('/', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const body = await c.req.json()

  const result = createSiteSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const { name, url, checkInterval } = result.data

  // Create site
  const site = db
    .insert(schema.sites)
    .values({
      workspaceId,
      name,
      url,
      checkInterval,
    })
    .returning()
    .get()

  return c.json(getSiteWithDetails(site.id))
})

// Update site
sites.put('/:siteId', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)
  const body = await c.req.json()

  const result = updateSiteSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const updates: Record<string, any> = {}
  if (result.data.name !== undefined) updates.name = result.data.name
  if (result.data.url !== undefined) updates.url = result.data.url
  if (result.data.checkInterval !== undefined) updates.checkInterval = result.data.checkInterval
  if (result.data.isActive !== undefined) updates.isActive = result.data.isActive
  if (result.data.isSla !== undefined) updates.isSla = result.data.isSla
  if (result.data.license !== undefined) updates.license = result.data.license

  if (Object.keys(updates).length > 0) {
    db.update(schema.sites).set(updates).where(eq(schema.sites.id, siteId)).run()
  }

  return c.json(getSiteWithDetails(siteId))
})

// Delete site
sites.delete('/:siteId', requireWorkspace('editor'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  db.delete(schema.sites).where(eq(schema.sites.id, siteId)).run()

  return c.json({ success: true })
})

// Toggle star
sites.post('/:siteId/star', requireWorkspace('editor'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const newStarred = !site.isStarred
  db.update(schema.sites).set({ isStarred: newStarred }).where(eq(schema.sites.id, siteId)).run()

  return c.json({ isStarred: newStarred })
})

// Toggle SLA
sites.post('/:siteId/sla', requireWorkspace('editor'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const newSla = !site.isSla
  db.update(schema.sites).set({ isSla: newSla }).where(eq(schema.sites.id, siteId)).run()

  return c.json({ isSla: newSla })
})

// Reorder sites
sites.post('/reorder', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const body = await c.req.json()

  const result = reorderSitesSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  const { siteIds } = result.data

  // Update sort order for each site
  for (let i = 0; i < siteIds.length; i++) {
    db.update(schema.sites)
      .set({ sortOrder: i })
      .where(and(eq(schema.sites.id, siteIds[i]!), eq(schema.sites.workspaceId, workspaceId)))
      .run()
  }

  return c.json({ success: true })
})

// Trigger manual check
sites.post('/:siteId/check', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  try {
    const result = await checkSite(siteId)
    return c.json(result)
  } catch (error) {
    return c.json({ error: 'Check failed', message: (error as Error).message }, 500)
  }
})

// Simulate down (for testing)
sites.post('/:siteId/simulate-down', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const currentStatus = site.lastStatus || 'up'
  const newStatus = currentStatus === 'down' ? 'up' : 'down'
  const errorMessage = newStatus === 'down' ? 'Simulated downtime (TEST)' : null
  const now = new Date().toISOString()

  // Insert check record
  db.insert(schema.checks).values({
    siteId,
    status: newStatus,
    responseTime: newStatus === 'up' ? 100 : null,
    statusCode: newStatus === 'up' ? 200 : null,
    errorMessage,
  }).run()

  // Update cached status and notification state
  if (newStatus === 'down') {
    db.update(schema.sites)
      .set({
        lastStatus: newStatus,
        lastResponseTime: null,
        lastCheckedAt: now,
        consecutiveFailures: 2, // Set to threshold to trigger notification
        confirmedDownAt: now,
        downNotified: false,
      })
      .where(eq(schema.sites.id, siteId))
      .run()

    // Import notification and screenshot services dynamically
    const { sendNotification } = await import('../services/notifier')
    const { captureScreenshot, diagnoseProblem } = await import('../services/screenshot')

    // Diagnose and capture screenshot
    const diagnosis = diagnoseProblem(errorMessage, null)
    let screenshotBuffer: Buffer | null = null

    try {
      console.log(`[Simulate] Capturing screenshot for ${site.name}...`)
      screenshotBuffer = await captureScreenshot(site.url)
      if (screenshotBuffer) {
        console.log(`[Simulate] Screenshot captured for ${site.name}`)
      }
    } catch (error) {
      console.error(`[Simulate] Screenshot failed:`, (error as Error).message)
    }

    // Send notification with screenshot
    sendNotification(workspaceId, {
      siteName: site.name,
      siteUrl: site.url,
      status: 'down',
      errorMessage: errorMessage || undefined,
      diagnosis,
    }, screenshotBuffer || undefined).catch(console.error)

    // Mark as notified
    db.update(schema.sites)
      .set({ downNotified: true })
      .where(eq(schema.sites.id, siteId))
      .run()
  } else {
    // Recovery
    const downtimeMs = site.confirmedDownAt ? Date.now() - new Date(site.confirmedDownAt).getTime() : null

    db.update(schema.sites)
      .set({
        lastStatus: newStatus,
        lastResponseTime: 100,
        lastCheckedAt: now,
        consecutiveFailures: 0,
        confirmedDownAt: null,
        downNotified: false,
      })
      .where(eq(schema.sites.id, siteId))
      .run()

    // Send recovery notification if it was notified as down
    if (site.downNotified) {
      const { sendNotification } = await import('../services/notifier')
      sendNotification(workspaceId, {
        siteName: site.name,
        siteUrl: site.url,
        status: 'up',
        downtime: downtimeMs ? Math.round(downtimeMs / 1000) : undefined,
      }).catch(console.error)
    }
  }

  // Broadcast SSE event for real-time UI update
  broadcast(workspaceId, {
    type: 'check',
    siteId,
    status: newStatus as 'up' | 'down',
    responseTime: newStatus === 'up' ? 100 : null,
    isSlow: false,
  })

  return c.json({ status: newStatus, message: `Simulated ${newStatus} status` })
})

// Get widget token
sites.post('/:siteId/widget-token', requireWorkspace('editor'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  let token = site.widgetToken
  if (!token) {
    token = generateToken()
    db.update(schema.sites).set({ widgetToken: token }).where(eq(schema.sites.id, siteId)).run()
  }

  return c.json({ widgetToken: token })
})

// Get check history
sites.get('/:siteId/checks', requireWorkspace('guest'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const siteId = parseInt(c.req.param('siteId'), 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 50000)

  const site = db
    .select()
    .from(schema.sites)
    .where(and(eq(schema.sites.id, siteId), eq(schema.sites.workspaceId, workspaceId)))
    .get()

  if (!site) {
    return c.json({ error: 'Site not found' }, 404)
  }

  const checks = db
    .select()
    .from(schema.checks)
    .where(eq(schema.checks.siteId, siteId))
    .orderBy(desc(schema.checks.checkedAt))
    .limit(limit)
    .all()

  return c.json(checks)
})

export default sites
