import { Hono } from 'hono'
import { db, schema, sqlite } from '../db/client'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { requireWorkspace, type WorkspaceContext } from '../middleware/auth'

const analytics = new Hono<WorkspaceContext>()

// In-memory cache for analytics queries (60 second TTL)
const cache = new Map<string, { data: any; expires: number }>()
const CACHE_TTL = 60_000 // 60 seconds

const getCacheKey = (workspaceId: number, siteIds: number[], timeRange: string, metrics: string) =>
  `${workspaceId}:${siteIds.sort().join(',')}:${timeRange}:${metrics}`

// Helper to calculate time offset based on range
const getTimeOffset = (timeRange: string): string => {
  const offsets: Record<string, string> = {
    '1d': '-1 day',
    '1w': '-7 days',
    '1m': '-1 month',
    '3m': '-3 months',
    '6m': '-6 months',
    '1y': '-1 year'
  }
  return offsets[timeRange] || '-7 days'
}

// Helper to get bucket size for time series
const getBucketFormat = (timeRange: string): string => {
  if (timeRange === '1d' || timeRange === '1w') {
    return 'hour' // Hourly buckets
  } else if (timeRange === '1m' || timeRange === '3m') {
    return 'day' // Daily buckets
  } else {
    return 'week' // Weekly buckets
  }
}

// Get response time analytics
analytics.get('/response-times', requireWorkspace('guest'), (c: any) => {
  const workspaceId = c.get('workspaceId')
  const timeRange = c.req.query('timeRange') || '1w'
  const siteIdsParam = c.req.query('siteIds')
  const metricsParam = c.req.query('metrics') || 'stats'

  // Parse site IDs
  let siteIds: number[] = []
  if (siteIdsParam) {
    siteIds = siteIdsParam.split(',').map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id))
  }

  // If no site IDs provided, get all sites for this workspace
  if (siteIds.length === 0) {
    const allSites = db
      .select({ id: schema.sites.id })
      .from(schema.sites)
      .where(eq(schema.sites.workspaceId, workspaceId))
      .all()
    siteIds = allSites.map(s => s.id)
  }

  if (siteIds.length === 0) {
    return c.json({})
  }

  // Verify all sites belong to this workspace
  const validSites = db
    .select({ id: schema.sites.id })
    .from(schema.sites)
    .where(and(
      inArray(schema.sites.id, siteIds),
      eq(schema.sites.workspaceId, workspaceId)
    ))
    .all()

  if (validSites.length === 0) {
    return c.json({ error: 'No valid sites found' }, 404)
  }

  const validSiteIds = validSites.map(s => s.id)

  // Parse metrics
  const metricsArray = metricsParam.split(',')

  // Check cache
  const cacheKey = getCacheKey(workspaceId, validSiteIds, timeRange, metricsParam)
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return c.json(cached.data)
  }

  const timeOffset = getTimeOffset(timeRange)
  const result: any = {}

  // Compute stats if requested
  if (metricsArray.includes('stats')) {
    const statsStart = Date.now()
    const siteIdList = validSiteIds.join(',')

    // Get aggregate stats with percentiles and uptime
    const stats = sqlite.query<{
      siteId: number
      avg: number | null
      min: number | null
      max: number | null
      totalChecks: number
      p50: number | null
      p95: number | null
      p99: number | null
      upChecks: number
    }, []>(`
      SELECT
        site_id as siteId,
        AVG(response_time) as avg,
        MIN(response_time) as min,
        MAX(response_time) as max,
        COUNT(*) as totalChecks,
        (SELECT response_time FROM (
          SELECT response_time,
                 ROW_NUMBER() OVER (ORDER BY response_time) as rn,
                 COUNT(*) OVER () as total
          FROM checks
          WHERE site_id = c.site_id
            AND checked_at >= datetime('now', '${timeOffset}')
            AND response_time IS NOT NULL
        ) WHERE rn = CAST(total * 0.5 AS INTEGER)) as p50,
        (SELECT response_time FROM (
          SELECT response_time,
                 ROW_NUMBER() OVER (ORDER BY response_time) as rn,
                 COUNT(*) OVER () as total
          FROM checks
          WHERE site_id = c.site_id
            AND checked_at >= datetime('now', '${timeOffset}')
            AND response_time IS NOT NULL
        ) WHERE rn = CAST(total * 0.95 AS INTEGER)) as p95,
        (SELECT response_time FROM (
          SELECT response_time,
                 ROW_NUMBER() OVER (ORDER BY response_time) as rn,
                 COUNT(*) OVER () as total
          FROM checks
          WHERE site_id = c.site_id
            AND checked_at >= datetime('now', '${timeOffset}')
            AND response_time IS NOT NULL
        ) WHERE rn = CAST(total * 0.99 AS INTEGER)) as p99,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as upChecks
      FROM checks c
      WHERE site_id IN (${siteIdList})
        AND checked_at >= datetime('now', '${timeOffset}')
        AND response_time IS NOT NULL
      GROUP BY site_id
    `).all()

    console.log(`[Analytics] stats query: ${Date.now() - statsStart}ms`)

    result.stats = stats.reduce((acc: any, row: any) => {
      acc[row.siteId] = {
        avg: row.avg ? Math.round(row.avg) : 0,
        p50: row.p50 || 0,
        p95: row.p95 || 0,
        p99: row.p99 || 0,
        min: row.min || 0,
        max: row.max || 0,
        totalChecks: row.totalChecks || 0,
        uptime: row.totalChecks > 0 ? parseFloat(((row.upChecks / row.totalChecks) * 100).toFixed(2)) : 100
      }
      return acc
    }, {})
  }

  // Compute timeseries if requested
  if (metricsArray.includes('timeseries')) {
    const timeseriesStart = Date.now()
    const bucketFormat = getBucketFormat(timeRange)
    const siteIdList = validSiteIds.join(',')

    let bucketSql = ''
    if (bucketFormat === 'hour') {
      bucketSql = "strftime('%Y-%m-%d %H:00:00', checked_at)"
    } else if (bucketFormat === 'day') {
      bucketSql = "date(checked_at)"
    } else { // week
      bucketSql = "date(checked_at, 'weekday 0', '-6 days')" // Start of week (Monday)
    }

    const timeseries = sqlite.query<{
      siteId: number
      bucketTime: string
      avgResponse: number
      p95: number | null
      checkCount: number
    }, []>(`
      SELECT
        site_id as siteId,
        ${bucketSql} as bucketTime,
        AVG(response_time) as avgResponse,
        (SELECT response_time FROM (
          SELECT response_time,
                 ROW_NUMBER() OVER (ORDER BY response_time) as rn,
                 COUNT(*) OVER () as total
          FROM checks
          WHERE site_id = c.site_id
            AND ${bucketSql} = bucket
            AND response_time IS NOT NULL
        ) WHERE rn = CAST(total * 0.95 AS INTEGER)) as p95,
        COUNT(*) as checkCount
      FROM checks c, (SELECT ${bucketSql} as bucket FROM checks WHERE site_id IN (${siteIdList}) AND checked_at >= datetime('now', '${timeOffset}') GROUP BY bucket) buckets
      WHERE site_id IN (${siteIdList})
        AND checked_at >= datetime('now', '${timeOffset}')
        AND response_time IS NOT NULL
        AND ${bucketSql} = bucket
      GROUP BY site_id, bucketTime
      ORDER BY bucketTime ASC
    `).all()

    console.log(`[Analytics] timeseries query: ${Date.now() - timeseriesStart}ms`)

    // Group by site
    result.timeseries = timeseries.reduce((acc: any, row: any) => {
      if (!acc[row.siteId]) {
        acc[row.siteId] = []
      }
      acc[row.siteId].push({
        timestamp: row.bucketTime,
        avg: Math.round(row.avgResponse),
        p95: row.p95 || Math.round(row.avgResponse),
        count: row.checkCount
      })
      return acc
    }, {})
  }

  // Compute distribution if requested
  if (metricsArray.includes('distribution')) {
    const distributionStart = Date.now()
    const siteIdList = validSiteIds.join(',')

    const distribution = sqlite.query<{
      siteId: number
      bucket: string
      count: number
    }, []>(`
      SELECT
        site_id as siteId,
        CASE
          WHEN response_time < 100 THEN '0-100ms'
          WHEN response_time < 200 THEN '100-200ms'
          WHEN response_time < 500 THEN '200-500ms'
          WHEN response_time < 1000 THEN '500ms-1s'
          WHEN response_time < 2000 THEN '1-2s'
          WHEN response_time < 3000 THEN '2-3s'
          ELSE '>3s'
        END as bucket,
        COUNT(*) as count
      FROM checks
      WHERE site_id IN (${siteIdList})
        AND checked_at >= datetime('now', '${timeOffset}')
        AND response_time IS NOT NULL
      GROUP BY site_id, bucket
    `).all()

    console.log(`[Analytics] distribution query: ${Date.now() - distributionStart}ms`)

    // Group by site and calculate percentages
    const distributionBySite: any = {}
    for (const row of distribution) {
      if (!distributionBySite[row.siteId]) {
        distributionBySite[row.siteId] = { total: 0, buckets: {} }
      }
      distributionBySite[row.siteId].buckets[row.bucket] = row.count
      distributionBySite[row.siteId].total += row.count
    }

    result.distribution = Object.keys(distributionBySite).reduce((acc: any, siteId: string) => {
      const site = distributionBySite[siteId]
      const buckets = ['0-100ms', '100-200ms', '200-500ms', '500ms-1s', '1-2s', '2-3s', '>3s']
      acc[siteId] = buckets.map(bucket => ({
        bucket,
        count: site.buckets[bucket] || 0,
        percentage: site.total > 0 ? parseFloat(((site.buckets[bucket] || 0) / site.total * 100).toFixed(1)) : 0
      }))
      return acc
    }, {})
  }

  // Compute comparison if requested
  if (metricsArray.includes('comparison')) {
    const comparisonStart = Date.now()
    const bucketFormat = getBucketFormat(timeRange)
    const siteIdList = validSiteIds.join(',')

    let bucketSql = ''
    if (bucketFormat === 'hour') {
      bucketSql = "strftime('%Y-%m-%d %H:00:00', checked_at)"
    } else if (bucketFormat === 'day') {
      bucketSql = "date(checked_at)"
    } else { // week
      bucketSql = "date(checked_at, 'weekday 0', '-6 days')"
    }

    // Get all unique buckets first
    const buckets = sqlite.query<{ bucket: string }, []>(`
      SELECT DISTINCT ${bucketSql} as bucket
      FROM checks
      WHERE site_id IN (${siteIdList})
        AND checked_at >= datetime('now', '${timeOffset}')
        AND response_time IS NOT NULL
      ORDER BY bucket ASC
    `).all()

    const timestamps = buckets.map(b => b.bucket)

    // Get average response times per site per bucket
    const comparison = sqlite.query<{
      siteId: number
      bucketTime: string
      avgResponse: number
    }, []>(`
      SELECT
        site_id as siteId,
        ${bucketSql} as bucketTime,
        AVG(response_time) as avgResponse
      FROM checks
      WHERE site_id IN (${siteIdList})
        AND checked_at >= datetime('now', '${timeOffset}')
        AND response_time IS NOT NULL
      GROUP BY site_id, bucketTime
      ORDER BY bucketTime ASC
    `).all()

    console.log(`[Analytics] comparison query: ${Date.now() - comparisonStart}ms`)

    // Build series data aligned with timestamps
    const series: any = {}
    for (const siteId of validSiteIds) {
      series[siteId] = new Array(timestamps.length).fill(null)
    }

    for (const row of comparison) {
      const index = timestamps.indexOf(row.bucketTime)
      if (index >= 0) {
        series[row.siteId][index] = Math.round(row.avgResponse)
      }
    }

    result.comparison = {
      timestamps,
      series
    }
  }

  // Cache the result
  cache.set(cacheKey, {
    data: result,
    expires: Date.now() + CACHE_TTL
  })

  return c.json(result)
})

export default analytics
