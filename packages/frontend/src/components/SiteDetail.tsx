import { createSignal, createEffect, Show, For, onCleanup } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import type { SiteWithDetails } from '@observer/shared'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { sites } from '../lib/api'

type Check = {
  id: number
  siteId: number
  status: string
  responseTime: number | null
  statusCode: number | null
  errorMessage: string | null
  isSlow: boolean
  checkedAt: string
}

export default function SiteDetail() {
  const params = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [site, setSite] = createSignal<SiteWithDetails | null>(null)
  const [checks, setChecks] = createSignal<Check[]>([])
  const [isLoading, setIsLoading] = createSignal(true)
  const [isLoadingChecks, setIsLoadingChecks] = createSignal(false)
  const [error, setError] = createSignal('')
  const [currentPage, setCurrentPage] = createSignal(1)
  const [dateFrom, setDateFrom] = createSignal('')
  const [dateTo, setDateTo] = createSignal('')
  const [timeScale, setTimeScale] = createSignal('4h') // Default to 4 hours
  const itemsPerPage = 25

  // Calculate how many checks to fetch based on time scale (with small buffer)
  const getChecksLimit = (scale: string) => {
    const scaleToChecks: Record<string, number> = {
      '4h': 300,      // 4 hours + buffer
      '8h': 550,      // 8 hours + buffer
      '12h': 800,     // 12 hours + buffer
      '1d': 1600,     // 1 day + buffer
      '1w': 11000,    // 1 week + buffer
      '1m': 45000,    // 1 month + buffer
    }
    return scaleToChecks[scale] || 300
  }

  const fetchSite = async () => {
    if (!auth.currentWorkspace) return
    const siteId = parseInt(params.siteId, 10)
    if (isNaN(siteId)) {
      setError('Invalid site ID')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const siteData = await sites.get(auth.currentWorkspace.id, siteId)
      setSite(siteData)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchChecks = async (scale: string) => {
    if (!auth.currentWorkspace) return
    const siteId = parseInt(params.siteId, 10)
    if (isNaN(siteId)) return

    try {
      setIsLoadingChecks(true)
      const limit = getChecksLimit(scale)
      const checksData = await sites.getChecks(auth.currentWorkspace.id, siteId, limit)
      setChecks(checksData)
    } catch (err) {
      console.error('Failed to fetch checks:', err)
    } finally {
      setIsLoadingChecks(false)
    }
  }

  const [siteLoaded, setSiteLoaded] = createSignal(false)

  // Load site info once
  createEffect(() => {
    if (auth.currentWorkspace && !siteLoaded()) {
      fetchSite()
      setSiteLoaded(true)
    }
  })

  // Load checks for current time scale
  createEffect(() => {
    const scale = timeScale()
    if (auth.currentWorkspace && siteLoaded()) {
      fetchChecks(scale)
    }
  })

  // Auto-refresh every 60 seconds - only refresh checks for current scale
  const refreshInterval = setInterval(() => {
    if (auth.currentWorkspace) {
      fetchSite()
      fetchChecks(timeScale())
    }
  }, 60000)
  onCleanup(() => clearInterval(refreshInterval))

  const formatResponseTime = (ms: number | null) => {
    if (ms === null) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleString()
  }

  const formatRelativeTime = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  // Color gradient for response times: green (fast) to red (slow)
  const getColorForResponseTime = (responseTime: number) => {
    if (responseTime <= 500) {
      // Green to yellow-green gradient (0-500ms)
      const ratio = responseTime / 500
      const r = Math.round(16 + (180 - 16) * ratio)
      const g = Math.round(163 + (200 - 163) * ratio)
      const b = Math.round(127 + (0 - 127) * ratio)
      return `rgb(${r}, ${g}, ${b})`
    } else if (responseTime <= 1500) {
      // Yellow to orange gradient (500-1500ms)
      const ratio = (responseTime - 500) / 1000
      const r = Math.round(180 + (249 - 180) * ratio)
      const g = Math.round(200 + (115 - 200) * ratio)
      const b = 0
      return `rgb(${r}, ${g}, ${b})`
    } else if (responseTime <= 3000) {
      // Orange to red gradient (1500-3000ms)
      const ratio = (responseTime - 1500) / 1500
      const r = Math.round(249 + (239 - 249) * ratio)
      const g = Math.round(115 + (68 - 115) * ratio)
      const b = Math.round(0 + (68 - 0) * ratio)
      return `rgb(${r}, ${g}, ${b})`
    } else {
      // Deep red for very slow (>3000ms)
      return 'rgb(239, 68, 68)'
    }
  }

  const getStatusBadge = (status: string, isSlow: boolean) => {
    if (status === 'down') {
      return <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-500">Down</span>
    }
    if (isSlow) {
      return <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-500">Slow</span>
    }
    return <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-500">Up</span>
  }

  // Graph dimensions
  const graphWidth = 800
  const graphHeight = 200
  const graphPadding = { top: 20, right: 20, bottom: 30, left: 60 }

  const graphData = () => {
    // Calculate how many checks to show based on time scale (checks run every 60s)
    const scaleToChecks: Record<string, number> = {
      '4h': 240,
      '8h': 480,
      '12h': 720,
      '1d': 1440,
      '1w': 10080,
      '1m': 43200,
    }
    const maxChecks = scaleToChecks[timeScale()] || 240
    const data = checks().filter(c => c.responseTime !== null).slice(0, maxChecks).reverse()
    if (data.length === 0) return null

    const times = data.map(c => c.responseTime!)
    const maxTime = Math.max(...times, 1000) * 1.1
    const minTime = 0

    const innerWidth = graphWidth - graphPadding.left - graphPadding.right
    const innerHeight = graphHeight - graphPadding.top - graphPadding.bottom

    const points = data.map((check, i) => {
      const x = graphPadding.left + (i / (data.length - 1 || 1)) * innerWidth
      const y = graphPadding.top + innerHeight - ((check.responseTime! - minTime) / (maxTime - minTime)) * innerHeight
      return { x, y, check }
    })

    // Create path for area
    const areaPath = `M ${points[0].x} ${graphPadding.top + innerHeight} ` +
      points.map(p => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points[points.length - 1].x} ${graphPadding.top + innerHeight} Z`

    // Create colored line segments
    const lineSegments = points.slice(0, -1).map((point, i) => {
      const nextPoint = points[i + 1]
      const avgResponseTime = (point.check.responseTime! + nextPoint.check.responseTime!) / 2
      return {
        x1: point.x,
        y1: point.y,
        x2: nextPoint.x,
        y2: nextPoint.y,
        color: getColorForResponseTime(avgResponseTime),
        responseTime: avgResponseTime
      }
    })

    // Generate time labels for x-axis
    const numTimeLabels = Math.min(6, data.length)
    const timeLabels = Array.from({ length: numTimeLabels }, (_, i) => {
      const index = Math.floor(i * (data.length - 1) / (numTimeLabels - 1 || 1))
      const check = data[index]
      const x = graphPadding.left + (index / (data.length - 1 || 1)) * innerWidth
      const date = new Date(check.checkedAt)

      // Format label based on time scale
      let label: string
      const currentScale = timeScale()
      if (currentScale === '1w' || currentScale === '1m') {
        // For long ranges, show date
        label = `${date.getMonth() + 1}/${date.getDate()}`
      } else if (currentScale === '1d') {
        // For 1 day, check if we need date
        const now = new Date()
        const isToday = date.toDateString() === now.toDateString()
        if (isToday) {
          label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        } else {
          label = `${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
        }
      } else {
        // Default: just show time
        label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      }

      return { x, label, date }
    })

    return { points, areaPath, lineSegments, maxTime, innerHeight, innerWidth, timeLabels, data }
  }

  const handleBack = () => {
    navigate('/')
  }

  // Filtered checks by date range
  const filteredChecks = () => {
    let result = checks()

    if (dateFrom()) {
      const fromDate = new Date(dateFrom())
      result = result.filter(c => new Date(c.checkedAt) >= fromDate)
    }

    if (dateTo()) {
      const toDate = new Date(dateTo())
      toDate.setHours(23, 59, 59, 999) // Include the entire end day
      result = result.filter(c => new Date(c.checkedAt) <= toDate)
    }

    return result
  }

  // Pagination
  const totalPages = () => Math.ceil(filteredChecks().length / itemsPerPage)
  const paginatedChecks = () => {
    const start = (currentPage() - 1) * itemsPerPage
    return filteredChecks().slice(start, start + itemsPerPage)
  }

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setCurrentPage(1)
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages()) {
      setCurrentPage(page)
    }
  }

  const pageNumbers = () => {
    const total = totalPages()
    const current = currentPage()
    const pages: (number | string)[] = []

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      if (current > 3) pages.push('...')
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i)
      }
      if (current < total - 2) pages.push('...')
      pages.push(total)
    }
    return pages
  }

  return (
    <div class="min-h-screen bg-[var(--bg)] transition-theme">
      {/* Header */}
      <header class="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl transition-theme">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-3 py-2 sm:px-6 sm:py-4">
          <div class="flex items-center gap-4">
            <button
              onClick={handleBack}
              class="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span class="hidden sm:inline">Back to Dashboard</span>
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            >
              <Show when={theme() === 'dark'} fallback={
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              }>
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </Show>
            </button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
        <Show when={isLoading()}>
          <div class="flex items-center justify-center py-20">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--text)] border-t-transparent" />
          </div>
        </Show>

        <Show when={error()}>
          <div class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error()}
          </div>
        </Show>

        <Show when={!isLoading() && site()}>
          {/* Site Header */}
          <div class="mb-8">
            <div class="flex items-center gap-3 mb-2">
              <div class={`h-3 w-3 rounded-full ${
                site()!.lastStatus === 'down' ? 'bg-red-500' :
                site()!.isSlow ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              <h1 class="text-2xl font-semibold text-[var(--text)]">{site()!.name}</h1>
            </div>
            <a
              href={site()!.url}
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--text-tertiary)] hover:text-[var(--text)] hover:underline"
            >
              {site()!.url}
            </a>
          </div>

          {/* Stats Row */}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4">
              <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Status</div>
              <div class="text-lg font-semibold text-[var(--text)]">
                {site()!.lastStatus === 'down' ? 'Down' : site()!.isSlow ? 'Slow' : 'Up'}
              </div>
            </div>
            <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4">
              <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Response Time</div>
              <div class="text-lg font-semibold text-[var(--text)] font-mono">
                {formatResponseTime(site()!.lastResponseTime)}
              </div>
            </div>
            <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4">
              <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Uptime (30d)</div>
              <div class="text-lg font-semibold text-[var(--text)] font-mono">
                {site()!.uptime !== null ? `${site()!.uptime!.toFixed(2)}%` : '-'}
              </div>
            </div>
            <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4">
              <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-1">SSL Expires</div>
              <div class={`text-lg font-semibold font-mono ${
                site()!.sslDaysRemaining !== null && site()!.sslDaysRemaining! < 14
                  ? 'text-orange-500' : 'text-[var(--text)]'
              }`}>
                {site()!.sslDaysRemaining !== null ? `${site()!.sslDaysRemaining}d` : '-'}
              </div>
            </div>
          </div>

          {/* Response Time Graph */}
          <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-6 mb-8">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h2 class="text-lg font-medium text-[var(--text)]">Response Time History</h2>
              <div class="flex items-center gap-2 flex-wrap">
                <For each={[
                  { value: '4h', label: '4H' },
                  { value: '8h', label: '8H' },
                  { value: '12h', label: '12H' },
                  { value: '1d', label: '1D' },
                  { value: '1w', label: '1W' },
                  { value: '1m', label: '1M' },
                ]}>
                  {(scale) => (
                    <button
                      onClick={() => setTimeScale(scale.value)}
                      class={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        timeScale() === scale.value
                          ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg)] font-medium'
                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {scale.label}
                    </button>
                  )}
                </For>
              </div>
            </div>
            <Show when={graphData()} fallback={
              <div class="text-center py-8 text-[var(--text-tertiary)]">No response data available</div>
            }>
              {(data) => (
                <div class="overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                    class="w-full max-w-full"
                    style={{ "min-width": "400px" }}
                  >
                    {/* Horizontal grid lines (Y-axis) */}
                    <For each={[0, 0.25, 0.5, 0.75, 1]}>
                      {(ratio) => (
                        <>
                          <line
                            x1={graphPadding.left}
                            y1={graphPadding.top + data().innerHeight * ratio}
                            x2={graphPadding.left + data().innerWidth}
                            y2={graphPadding.top + data().innerHeight * ratio}
                            stroke="var(--border)"
                            stroke-width="1"
                          />
                          <text
                            x={graphPadding.left - 8}
                            y={graphPadding.top + data().innerHeight * ratio + 4}
                            text-anchor="end"
                            class="text-[10px] fill-[var(--text-tertiary)]"
                          >
                            {formatResponseTime(Math.round(data().maxTime * (1 - ratio)))}
                          </text>
                        </>
                      )}
                    </For>

                    {/* Vertical grid lines and time labels (X-axis) */}
                    <For each={data().timeLabels}>
                      {(timeLabel) => (
                        <>
                          <line
                            x1={timeLabel.x}
                            y1={graphPadding.top}
                            x2={timeLabel.x}
                            y2={graphPadding.top + data().innerHeight}
                            stroke="var(--border)"
                            stroke-width="1"
                            stroke-dasharray="2,2"
                            opacity="0.5"
                          />
                          <text
                            x={timeLabel.x}
                            y={graphPadding.top + data().innerHeight + 18}
                            text-anchor="middle"
                            class="text-[10px] fill-[var(--text-tertiary)]"
                          >
                            {timeLabel.label}
                          </text>
                        </>
                      )}
                    </For>

                    {/* Area fill */}
                    <path
                      d={data().areaPath}
                      fill="url(#gradient)"
                      opacity="0.3"
                    />

                    {/* Color-coded line segments */}
                    <For each={data().lineSegments}>
                      {(segment) => (
                        <line
                          x1={segment.x1}
                          y1={segment.y1}
                          x2={segment.x2}
                          y2={segment.y2}
                          stroke={segment.color}
                          stroke-width="1"
                          stroke-linecap="round"
                        />
                      )}
                    </For>

                    {/* Gradient definition */}
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#10a37f" stop-opacity="0.5" />
                        <stop offset="100%" stop-color="#10a37f" stop-opacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              )}
            </Show>
          </div>

          {/* Check History Table */}
          <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 overflow-hidden">
            <div class="px-6 py-4 border-b border-[var(--border)]">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 class="text-lg font-medium text-[var(--text)]">Check History</h2>
                <div class="flex flex-wrap items-center gap-3">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-[var(--text-tertiary)]">From</label>
                    <input
                      type="datetime-local"
                      value={dateFrom()}
                      onInput={(e) => { setDateFrom(e.currentTarget.value); setCurrentPage(1) }}
                      class="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-[var(--text-tertiary)]">To</label>
                    <input
                      type="datetime-local"
                      value={dateTo()}
                      onInput={(e) => { setDateTo(e.currentTarget.value); setCurrentPage(1) }}
                      class="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                  <Show when={dateFrom() || dateTo()}>
                    <button
                      onClick={clearFilters}
                      class="text-xs text-[var(--text-tertiary)] hover:text-[var(--text)] underline"
                    >
                      Clear
                    </button>
                  </Show>
                </div>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-[var(--border)] bg-[var(--bg-tertiary)]/50">
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Time</th>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Response</th>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Code</th>
                    <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Error</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--border)]">
                  <For each={paginatedChecks()}>
                    {(check) => (
                      <tr class="hover:bg-[var(--bg-hover)] transition-colors">
                        <td class="px-6 py-3 whitespace-nowrap">
                          <div class="text-sm text-[var(--text)]">{formatRelativeTime(check.checkedAt)}</div>
                          <div class="text-xs text-[var(--text-tertiary)]">{formatDate(check.checkedAt)}</div>
                        </td>
                        <td class="px-6 py-3 whitespace-nowrap">
                          {getStatusBadge(check.status, check.isSlow)}
                        </td>
                        <td class="px-6 py-3 whitespace-nowrap font-mono text-sm text-[var(--text)]">
                          {formatResponseTime(check.responseTime)}
                        </td>
                        <td class="px-6 py-3 whitespace-nowrap font-mono text-sm text-[var(--text)]">
                          {check.statusCode ?? '-'}
                        </td>
                        <td class="px-6 py-3 text-sm text-[var(--text-tertiary)] max-w-xs truncate">
                          {check.errorMessage ?? '-'}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <Show when={filteredChecks().length === 0 && !isLoading()}>
              <div class="text-center py-8 text-[var(--text-tertiary)]">
                {checks().length === 0 ? 'No check history available' : 'No checks match the selected date range'}
              </div>
            </Show>

            {/* Pagination */}
            <Show when={totalPages() > 1}>
              <div class="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
                <div class="text-sm text-[var(--text-tertiary)]">
                  Showing {((currentPage() - 1) * itemsPerPage) + 1} to {Math.min(currentPage() * itemsPerPage, filteredChecks().length)} of {filteredChecks().length} checks
                  {(dateFrom() || dateTo()) && ` (filtered from ${checks().length})`}
                </div>
                <div class="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage() - 1)}
                    disabled={currentPage() === 1}
                    class="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <For each={pageNumbers()}>
                    {(page) => (
                      <Show when={typeof page === 'number'} fallback={
                        <span class="px-2 text-[var(--text-tertiary)]">...</span>
                      }>
                        <button
                          onClick={() => goToPage(page as number)}
                          class={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            currentPage() === page
                              ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg)] font-medium'
                              : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {page}
                        </button>
                      </Show>
                    )}
                  </For>
                  <button
                    onClick={() => goToPage(currentPage() + 1)}
                    disabled={currentPage() === totalPages()}
                    class="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </main>
    </div>
  )
}
