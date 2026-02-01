import { For, Show, createSignal, createMemo } from 'solid-js'
import type { SiteWithDetails, AnalyticsResponse } from '@observer/shared'

interface TrendChartProps {
  sites: SiteWithDetails[]
  data: AnalyticsResponse['timeseries']
}

const formatResponseTime = (ms: number | null) => {
  if (ms === null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Color gradient for response times (from SiteDetail.tsx)
const getColorForResponseTime = (responseTime: number) => {
  if (responseTime <= 500) {
    const ratio = responseTime / 500
    const r = Math.round(16 + (180 - 16) * ratio)
    const g = Math.round(163 + (200 - 163) * ratio)
    const b = Math.round(127 + (0 - 127) * ratio)
    return `rgb(${r}, ${g}, ${b})`
  } else if (responseTime <= 1500) {
    const ratio = (responseTime - 500) / 1000
    const r = Math.round(180 + (249 - 180) * ratio)
    const g = Math.round(200 + (115 - 200) * ratio)
    const b = 0
    return `rgb(${r}, ${g}, ${b})`
  } else if (responseTime <= 3000) {
    const ratio = (responseTime - 1500) / 1500
    const r = Math.round(249 + (239 - 249) * ratio)
    const g = Math.round(115 + (68 - 115) * ratio)
    const b = Math.round(0 + (68 - 0) * ratio)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    return 'rgb(239, 68, 68)'
  }
}

interface SiteTrendProps {
  site: SiteWithDetails
  data: { timestamp: string; avg: number; p95: number; count: number }[]
}

function SiteTrend(props: SiteTrendProps) {
  const [hoveredPoint, setHoveredPoint] = createSignal<{ timestamp: string; responseTime: number; x: number; y: number; mouseX: number; mouseY: number } | null>(null)
  const [expanded, setExpanded] = createSignal(true)

  const graphWidth = 800
  const graphHeight = 200
  const graphPadding = { top: 20, right: 20, bottom: 30, left: 60 }

  const chartData = createMemo(() => {
    const data = props.data
    if (data.length === 0) return null

    const times = data.map(d => d.avg)
    const maxTime = Math.max(...times, 1000) * 1.1
    const minTime = 0

    const innerWidth = graphWidth - graphPadding.left - graphPadding.right
    const innerHeight = graphHeight - graphPadding.top - graphPadding.bottom

    // Map points
    const points = data.map((point, i) => {
      const x = graphPadding.left + (i / (data.length - 1 || 1)) * innerWidth
      const y = graphPadding.top + innerHeight - ((point.avg - minTime) / (maxTime - minTime)) * innerHeight
      return { x, y, timestamp: point.timestamp, responseTime: point.avg }
    })

    // Create area path
    const areaPath = points.length > 0 ? (
      `M ${points[0].x} ${graphPadding.top + innerHeight} ` +
      points.map(p => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points[points.length - 1].x} ${graphPadding.top + innerHeight} Z`
    ) : ''

    // Create colored line segments
    const lineSegments = points.slice(0, -1).map((point, i) => {
      const nextPoint = points[i + 1]
      const avgResponseTime = (point.responseTime + nextPoint.responseTime) / 2
      return {
        x1: point.x,
        y1: point.y,
        x2: nextPoint.x,
        y2: nextPoint.y,
        color: getColorForResponseTime(avgResponseTime)
      }
    })

    return { points, areaPath, lineSegments, maxTime, innerHeight, innerWidth }
  })

  const handleMouseMove = (e: MouseEvent) => {
    const svg = e.currentTarget as SVGElement
    const ctm = svg.getScreenCTM()
    if (!ctm || !chartData()) return

    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgPoint = pt.matrixTransform(ctm.inverse())

    const mouseX = svgPoint.x
    const mouseY = svgPoint.y

    const data = chartData()!
    if (!data.points.length) {
      setHoveredPoint(null)
      return
    }

    let nearest = data.points[0]
    let minDist = Math.abs(data.points[0].x - mouseX)

    for (const point of data.points) {
      const dist = Math.abs(point.x - mouseX)
      if (dist < minDist) {
        minDist = dist
        nearest = point
      }
    }

    if (minDist < 50) {
      setHoveredPoint({
        timestamp: nearest.timestamp,
        responseTime: nearest.responseTime,
        x: nearest.x,
        y: nearest.y,
        mouseX,
        mouseY
      })
    } else {
      setHoveredPoint(null)
    }
  }

  return (
    <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded())}
        class="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div class="flex items-center gap-2">
          <div class={`h-2 w-2 rounded-full ${
            props.site.lastStatus === 'down' ? 'bg-red-500' :
            props.site.isSlow ? 'bg-amber-500' : 'bg-emerald-500'
          }`} />
          <h3 class="text-sm font-medium text-[var(--text)]">{props.site.name}</h3>
        </div>
        <svg
          class={`h-5 w-5 text-[var(--text-secondary)] transition-transform ${expanded() ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Show when={expanded()}>
        <div class="px-4 pb-4">
          <Show when={chartData()} fallback={
            <div class="text-center py-8 text-[var(--text-tertiary)] text-sm">
              No trend data available
            </div>
          }>
            {(data) => (
              <div class="overflow-x-auto">
                <svg
                  viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                  class="w-full max-w-full"
                  style={{ "min-width": "400px" }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoveredPoint(null)}
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
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    )}
                  </For>

                  {/* Hover crosshair and tooltip */}
                  <Show when={hoveredPoint()}>
                    {(point) => (
                      <>
                        <line
                          x1={point().mouseX}
                          y1={graphPadding.top}
                          x2={point().mouseX}
                          y2={graphPadding.top + data().innerHeight}
                          stroke="var(--text)"
                          stroke-width="1"
                          stroke-dasharray="4,4"
                          opacity="0.5"
                        />
                        <circle
                          cx={point().x}
                          cy={point().y}
                          r="4"
                          fill="var(--text)"
                          stroke="var(--bg)"
                          stroke-width="2"
                        />
                        <foreignObject
                          x={point().mouseX + 15}
                          y={point().mouseY - 40}
                          width="150"
                          height="50"
                        >
                          <div class="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-2 shadow-lg text-xs pointer-events-none">
                            <div class="font-mono font-semibold text-[var(--text)]">
                              {formatResponseTime(point().responseTime)}
                            </div>
                            <div class="text-[var(--text-tertiary)] text-[10px]">
                              {formatTimestamp(point().timestamp)}
                            </div>
                          </div>
                        </foreignObject>
                      </>
                    )}
                  </Show>

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
      </Show>
    </div>
  )
}

export default function TrendChart(props: TrendChartProps) {
  return (
    <Show when={props.data} fallback={
      <div class="text-center py-8 text-[var(--text-tertiary)]">
        Loading trends...
      </div>
    }>
      <div class="space-y-4">
        <For each={props.sites}>
          {(site) => {
            const siteData = props.data?.[site.id]
            if (!siteData || siteData.length === 0) return null

            return <SiteTrend site={site} data={siteData} />
          }}
        </For>
      </div>
    </Show>
  )
}
