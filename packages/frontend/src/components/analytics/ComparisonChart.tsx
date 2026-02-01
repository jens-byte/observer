import { For, Show, createSignal, createMemo } from 'solid-js'
import type { SiteWithDetails, AnalyticsResponse } from '@observer/shared'

interface ComparisonChartProps {
  sites: SiteWithDetails[]
  data: AnalyticsResponse['comparison']
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

// Color palette for different sites
const siteColors = [
  '#10a37f', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
]

export default function ComparisonChart(props: ComparisonChartProps) {
  const [hoveredPoint, setHoveredPoint] = createSignal<{ x: number; timestamp: string; values: Record<number, number | null> } | null>(null)

  const graphWidth = 900
  const graphHeight = 300
  const graphPadding = { top: 20, right: 140, bottom: 50, left: 60 }

  const chartData = createMemo(() => {
    if (!props.data || !props.data.timestamps || props.data.timestamps.length === 0) {
      return null
    }

    const timestamps = props.data.timestamps
    const series = props.data.series

    // Find max value for Y-axis scaling
    let maxValue = 0
    for (const siteId in series) {
      const values = series[siteId]
      for (const val of values) {
        if (val !== null && val > maxValue) {
          maxValue = val
        }
      }
    }

    maxValue = Math.max(maxValue * 1.1, 100) // Add 10% padding, min 100ms

    const innerWidth = graphWidth - graphPadding.left - graphPadding.right
    const innerHeight = graphHeight - graphPadding.top - graphPadding.bottom

    return {
      timestamps,
      series,
      maxValue,
      innerWidth,
      innerHeight
    }
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
    const data = chartData()!

    // Find nearest timestamp
    const timestamps = data.timestamps
    const innerWidth = data.innerWidth

    let nearestIndex = 0
    let minDist = Infinity

    for (let i = 0; i < timestamps.length; i++) {
      const x = graphPadding.left + (i / (timestamps.length - 1 || 1)) * innerWidth
      const dist = Math.abs(x - mouseX)
      if (dist < minDist) {
        minDist = dist
        nearestIndex = i
      }
    }

    if (minDist < 50) {
      const values: Record<number, number | null> = {}
      for (const siteId in data.series) {
        values[parseInt(siteId)] = data.series[siteId][nearestIndex] ?? null
      }

      const x = graphPadding.left + (nearestIndex / (timestamps.length - 1 || 1)) * innerWidth

      setHoveredPoint({
        x,
        timestamp: timestamps[nearestIndex],
        values
      })
    } else {
      setHoveredPoint(null)
    }
  }

  return (
    <Show when={chartData()} fallback={
      <div class="text-center py-8 text-[var(--text-tertiary)]">
        No comparison data available
      </div>
    }>
      {(data) => (
        <div>
          {/* Legend */}
          <div class="mb-4 flex flex-wrap gap-4">
            <For each={props.sites}>
              {(site, index) => {
                const color = siteColors[index() % siteColors.length]
                return (
                  <div class="flex items-center gap-2">
                    <div class="h-3 w-3 rounded-full" style={{ background: color }} />
                    <span class="text-xs text-[var(--text)]">{site.name}</span>
                  </div>
                )
              }}
            </For>
          </div>

          {/* Chart */}
          <div class="overflow-x-auto">
            <svg
              viewBox={`0 0 ${graphWidth} ${graphHeight}`}
              class="w-full max-w-full"
              style={{ "min-width": "600px" }}
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
                      opacity="0.3"
                    />
                    <text
                      x={graphPadding.left - 8}
                      y={graphPadding.top + data().innerHeight * ratio + 4}
                      text-anchor="end"
                      class="text-[10px] fill-[var(--text-tertiary)]"
                    >
                      {formatResponseTime(Math.round(data().maxValue * (1 - ratio)))}
                    </text>
                  </>
                )}
              </For>

              {/* X-axis labels */}
              <For each={data().timestamps.filter((_, i) => i % Math.max(1, Math.floor(data().timestamps.length / 6)) === 0)}>
                {(timestamp, index) => {
                  const i = data().timestamps.indexOf(timestamp)
                  const x = graphPadding.left + (i / (data().timestamps.length - 1 || 1)) * data().innerWidth
                  return (
                    <>
                      <line
                        x1={x}
                        y1={graphPadding.top}
                        x2={x}
                        y2={graphPadding.top + data().innerHeight}
                        stroke="var(--border)"
                        stroke-width="1"
                        opacity="0.2"
                        stroke-dasharray="2,2"
                      />
                      <text
                        x={x}
                        y={graphPadding.top + data().innerHeight + 18}
                        text-anchor="middle"
                        class="text-[9px] fill-[var(--text-tertiary)]"
                      >
                        {formatTimestamp(timestamp)}
                      </text>
                    </>
                  )
                }}
              </For>

              {/* Lines for each site */}
              <For each={props.sites}>
                {(site, siteIndex) => {
                  const siteId = site.id
                  const values = data().series[siteId]
                  if (!values) return null

                  const color = siteColors[siteIndex() % siteColors.length]

                  // Generate path
                  const points: { x: number; y: number }[] = []
                  for (let i = 0; i < values.length; i++) {
                    const val = values[i]
                    if (val !== null) {
                      const x = graphPadding.left + (i / (data().timestamps.length - 1 || 1)) * data().innerWidth
                      const y = graphPadding.top + data().innerHeight - (val / data().maxValue) * data().innerHeight
                      points.push({ x, y })
                    }
                  }

                  if (points.length === 0) return null

                  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

                  return (
                    <path
                      d={pathD}
                      stroke={color}
                      stroke-width="2"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  )
                }}
              </For>

              {/* Hover crosshair and tooltip */}
              <Show when={hoveredPoint()}>
                {(point) => (
                  <>
                    <line
                      x1={point().x}
                      y1={graphPadding.top}
                      x2={point().x}
                      y2={graphPadding.top + data().innerHeight}
                      stroke="var(--text)"
                      stroke-width="1"
                      stroke-dasharray="4,4"
                      opacity="0.5"
                    />

                    {/* Tooltip */}
                    <foreignObject
                      x={Math.min(point().x + 15, graphWidth - 160)}
                      y={graphPadding.top + 10}
                      width="150"
                      height="auto"
                    >
                      <div class="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 shadow-lg text-xs pointer-events-none">
                        <div class="text-[var(--text-tertiary)] text-[10px] mb-2">
                          {formatTimestamp(point().timestamp)}
                        </div>
                        <div class="space-y-1">
                          <For each={props.sites}>
                            {(site, siteIndex) => {
                              const value = point().values[site.id]
                              const color = siteColors[siteIndex() % siteColors.length]
                              return (
                                <div class="flex items-center justify-between gap-2">
                                  <div class="flex items-center gap-1.5 flex-1 min-w-0">
                                    <div class="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                                    <span class="text-[var(--text-tertiary)] truncate text-[10px]">{site.name}</span>
                                  </div>
                                  <span class="font-mono font-semibold text-[var(--text)] text-[10px]">
                                    {value !== null ? formatResponseTime(value) : '-'}
                                  </span>
                                </div>
                              )
                            }}
                          </For>
                        </div>
                      </div>
                    </foreignObject>
                  </>
                )}
              </Show>
            </svg>
          </div>
        </div>
      )}
    </Show>
  )
}
