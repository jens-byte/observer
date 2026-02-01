import { For, Show } from 'solid-js'
import type { SiteWithDetails, SiteStats } from '@observer/shared'

interface AggregateStatsProps {
  sites: SiteWithDetails[]
  stats: Record<number, SiteStats> | undefined
}

const formatResponseTime = (ms: number | null) => {
  if (ms === null || ms === 0) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const getColorForResponseTime = (responseTime: number): string => {
  if (responseTime <= 500) {
    return 'text-emerald-500'
  } else if (responseTime <= 1500) {
    return 'text-amber-500'
  } else {
    return 'text-red-500'
  }
}

export default function AggregateStats(props: AggregateStatsProps) {
  return (
    <Show when={props.stats} fallback={
      <div class="text-center py-8 text-[var(--text-tertiary)]">
        Loading stats...
      </div>
    }>
      {(stats) => (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={props.sites}>
            {(site) => {
              const siteStats = stats()[site.id]
              if (!siteStats) return null

              return (
                <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4">
                  <div class="flex items-center gap-2 mb-3">
                    <div class={`h-2 w-2 rounded-full flex-shrink-0 ${
                      site.lastStatus === 'down' ? 'bg-red-500' :
                      site.isSlow ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <h3 class="text-sm font-medium text-[var(--text)] truncate">{site.name}</h3>
                  </div>

                  <div class="space-y-2">
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <div class="text-xs text-[var(--text-tertiary)] mb-1">Avg</div>
                        <div class={`text-lg font-mono font-semibold ${getColorForResponseTime(siteStats.avg)}`}>
                          {formatResponseTime(siteStats.avg)}
                        </div>
                      </div>
                      <div>
                        <div class="text-xs text-[var(--text-tertiary)] mb-1">Uptime</div>
                        <div class="text-lg font-mono font-semibold text-[var(--text)]">
                          {siteStats.uptime.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div class="pt-2 border-t border-[var(--border)]">
                      <div class="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div class="text-[var(--text-tertiary)] mb-1">p50</div>
                          <div class="font-mono text-[var(--text)]">{formatResponseTime(siteStats.p50)}</div>
                        </div>
                        <div>
                          <div class="text-[var(--text-tertiary)] mb-1">p95</div>
                          <div class="font-mono text-[var(--text)]">{formatResponseTime(siteStats.p95)}</div>
                        </div>
                        <div>
                          <div class="text-[var(--text-tertiary)] mb-1">p99</div>
                          <div class="font-mono text-[var(--text)]">{formatResponseTime(siteStats.p99)}</div>
                        </div>
                      </div>
                    </div>

                    <div class="pt-2 border-t border-[var(--border)]">
                      <div class="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div class="text-[var(--text-tertiary)] mb-1">Min</div>
                          <div class="font-mono text-[var(--text)]">{formatResponseTime(siteStats.min)}</div>
                        </div>
                        <div>
                          <div class="text-[var(--text-tertiary)] mb-1">Max</div>
                          <div class="font-mono text-[var(--text)]">{formatResponseTime(siteStats.max)}</div>
                        </div>
                        <div>
                          <div class="text-[var(--text-tertiary)] mb-1">Checks</div>
                          <div class="font-mono text-[var(--text)]">{siteStats.totalChecks.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      )}
    </Show>
  )
}
