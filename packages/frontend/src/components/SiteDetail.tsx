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
  const [error, setError] = createSignal('')

  const fetchData = async () => {
    if (!auth.currentWorkspace) return
    const siteId = parseInt(params.siteId, 10)
    if (isNaN(siteId)) {
      setError('Invalid site ID')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const [siteData, checksData] = await Promise.all([
        sites.get(auth.currentWorkspace.id, siteId),
        sites.getChecks(auth.currentWorkspace.id, siteId, 500),
      ])
      setSite(siteData)
      setChecks(checksData)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  createEffect(() => {
    if (auth.currentWorkspace) {
      fetchData()
    }
  })

  // Auto-refresh every 60 seconds
  const refreshInterval = setInterval(fetchData, 60000)
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
    const data = checks().filter(c => c.responseTime !== null).slice(0, 100).reverse()
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

    // Create path for line
    const linePath = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`

    return { points, areaPath, linePath, maxTime, innerHeight, innerWidth }
  }

  const handleBack = () => {
    navigate('/')
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
            <h2 class="text-lg font-medium text-[var(--text)] mb-4">Response Time History</h2>
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
                    {/* Grid lines */}
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

                    {/* Area fill */}
                    <path
                      d={data().areaPath}
                      fill="url(#gradient)"
                      opacity="0.3"
                    />

                    {/* Line */}
                    <path
                      d={data().linePath}
                      fill="none"
                      stroke="#10a37f"
                      stroke-width="2"
                    />

                    {/* Points */}
                    <For each={data().points}>
                      {(point) => (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="3"
                          fill={point.check.status === 'down' ? '#ef4444' : point.check.isSlow ? '#f59e0b' : '#10a37f'}
                          class="hover:r-5 transition-all cursor-pointer"
                        >
                          <title>{`${formatResponseTime(point.check.responseTime)} - ${formatDate(point.check.checkedAt)}`}</title>
                        </circle>
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
              <h2 class="text-lg font-medium text-[var(--text)]">Check History</h2>
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
                  <For each={checks()}>
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
            <Show when={checks().length === 0 && !isLoading()}>
              <div class="text-center py-8 text-[var(--text-tertiary)]">No check history available</div>
            </Show>
          </div>
        </Show>
      </main>
    </div>
  )
}
