import { For, Show, createMemo } from 'solid-js'
import type { SiteWithDetails, AnalyticsResponse } from '@observer/shared'

interface DistributionChartProps {
  sites: SiteWithDetails[]
  data: AnalyticsResponse['distribution']
}

// Color mapping for buckets (faster = greener, slower = redder)
const bucketColors: Record<string, string> = {
  '0-100ms': '#10b981',      // emerald-500
  '100-200ms': '#84cc16',    // lime-500
  '200-500ms': '#eab308',    // yellow-500
  '500ms-1s': '#f97316',     // orange-500
  '1-2s': '#f59e0b',         // amber-500
  '2-3s': '#ef4444',         // red-500
  '>3s': '#dc2626',          // red-600
}

interface SiteDistributionProps {
  site: SiteWithDetails
  data: { bucket: string; count: number; percentage: number }[]
}

function SiteDistribution(props: SiteDistributionProps) {
  const graphWidth = 600
  const graphHeight = 300
  const graphPadding = { top: 20, right: 20, bottom: 60, left: 50 }

  const chartData = createMemo(() => {
    const data = props.data
    if (data.length === 0) return null

    const buckets = ['0-100ms', '100-200ms', '200-500ms', '500ms-1s', '1-2s', '2-3s', '>3s']

    // Fill in missing buckets with 0
    const fullData = buckets.map(bucket => {
      const found = data.find(d => d.bucket === bucket)
      return found || { bucket, count: 0, percentage: 0 }
    })

    const maxPercentage = Math.max(...fullData.map(d => d.percentage), 10)

    const innerWidth = graphWidth - graphPadding.left - graphPadding.right
    const innerHeight = graphHeight - graphPadding.top - graphPadding.bottom

    const barWidth = innerWidth / buckets.length - 8 // 8px gap
    const barGap = 8

    return {
      fullData,
      maxPercentage,
      innerWidth,
      innerHeight,
      barWidth,
      barGap
    }
  })

  return (
    <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4">
      <div class="flex items-center gap-2 mb-4">
        <div class={`h-2 w-2 rounded-full ${
          props.site.lastStatus === 'down' ? 'bg-red-500' :
          props.site.isSlow ? 'bg-amber-500' : 'bg-emerald-500'
        }`} />
        <h3 class="text-sm font-medium text-[var(--text)]">{props.site.name}</h3>
      </div>

      <Show when={chartData()} fallback={
        <div class="text-center py-8 text-[var(--text-tertiary)] text-sm">
          No distribution data available
        </div>
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
                      opacity="0.3"
                    />
                    <text
                      x={graphPadding.left - 8}
                      y={graphPadding.top + data().innerHeight * ratio + 4}
                      text-anchor="end"
                      class="text-[10px] fill-[var(--text-tertiary)]"
                    >
                      {Math.round(data().maxPercentage * (1 - ratio))}%
                    </text>
                  </>
                )}
              </For>

              {/* Bars */}
              <For each={data().fullData}>
                {(bucket, index) => {
                  const x = graphPadding.left + index() * (data().barWidth + data().barGap)
                  const barHeight = (bucket.percentage / data().maxPercentage) * data().innerHeight
                  const y = graphPadding.top + data().innerHeight - barHeight

                  return (
                    <g>
                      {/* Bar */}
                      <rect
                        x={x}
                        y={y}
                        width={data().barWidth}
                        height={barHeight}
                        fill={bucketColors[bucket.bucket] || '#6b7280'}
                        rx="4"
                      />

                      {/* Count label on top of bar */}
                      <Show when={bucket.count > 0}>
                        <text
                          x={x + data().barWidth / 2}
                          y={y - 5}
                          text-anchor="middle"
                          class="text-[9px] fill-[var(--text)] font-medium"
                        >
                          {bucket.count}
                        </text>
                      </Show>

                      {/* Percentage label inside bar */}
                      <Show when={bucket.percentage > 5}>
                        <text
                          x={x + data().barWidth / 2}
                          y={y + 14}
                          text-anchor="middle"
                          class="text-[9px] fill-white font-semibold"
                        >
                          {bucket.percentage.toFixed(1)}%
                        </text>
                      </Show>

                      {/* X-axis label */}
                      <text
                        x={x + data().barWidth / 2}
                        y={graphPadding.top + data().innerHeight + 15}
                        text-anchor="middle"
                        class="text-[9px] fill-[var(--text-tertiary)]"
                        transform={`rotate(45, ${x + data().barWidth / 2}, ${graphPadding.top + data().innerHeight + 15})`}
                      >
                        {bucket.bucket}
                      </text>
                    </g>
                  )
                }}
              </For>

              {/* Y-axis label */}
              <text
                x={graphPadding.left - 35}
                y={graphPadding.top + data().innerHeight / 2}
                text-anchor="middle"
                class="text-[10px] fill-[var(--text-tertiary)] font-medium"
                transform={`rotate(-90, ${graphPadding.left - 35}, ${graphPadding.top + data().innerHeight / 2})`}
              >
                Percentage (%)
              </text>
            </svg>
          </div>
        )}
      </Show>
    </div>
  )
}

export default function DistributionChart(props: DistributionChartProps) {
  return (
    <Show when={props.data} fallback={
      <div class="text-center py-8 text-[var(--text-tertiary)]">
        Loading distribution...
      </div>
    }>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <For each={props.sites}>
          {(site) => {
            const siteData = props.data?.[site.id]
            if (!siteData || siteData.length === 0) return null

            return <SiteDistribution site={site} data={siteData} />
          }}
        </For>
      </div>
    </Show>
  )
}
