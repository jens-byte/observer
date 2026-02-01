import { createSignal, createEffect, Show, For, onCleanup } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { analytics, sites as sitesApi } from '../lib/api'
import type { SiteWithDetails, AnalyticsResponse, AnalyticsTimeRange } from '@observer/shared'

import SiteSelector from './analytics/SiteSelector'
import TimeRangeSelector from './analytics/TimeRangeSelector'
import AggregateStats from './analytics/AggregateStats'
import ComparisonChart from './analytics/ComparisonChart'
import TrendChart from './analytics/TrendChart'
import DistributionChart from './analytics/DistributionChart'

type TabType = 'overview' | 'comparison' | 'trends' | 'distribution'

export default function Analytics() {
  const navigate = useNavigate()
  const auth = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [sites, setSites] = createSignal<SiteWithDetails[]>([])
  const [selectedSiteIds, setSelectedSiteIds] = createSignal<number[]>([])
  const [timeRange, setTimeRange] = createSignal<AnalyticsTimeRange>('1w')
  const [activeTab, setActiveTab] = createSignal<TabType>('overview')
  const [isLoadingSites, setIsLoadingSites] = createSignal(true)
  const [isLoadingData, setIsLoadingData] = createSignal(false)
  const [error, setError] = createSignal('')
  const [analyticsData, setAnalyticsData] = createSignal<AnalyticsResponse>({})

  // Fetch sites on mount
  createEffect(() => {
    const fetchSites = async () => {
      if (!auth.currentWorkspace) return

      try {
        setIsLoadingSites(true)
        const sitesList = await sitesApi.list(auth.currentWorkspace.id)
        setSites(sitesList)
        // Select all sites by default
        setSelectedSiteIds(sitesList.map(s => s.id))
        setError('')
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsLoadingSites(false)
      }
    }

    fetchSites()
  })

  // Fetch analytics data when filters change
  createEffect(() => {
    const fetchAnalytics = async () => {
      if (!auth.currentWorkspace || selectedSiteIds().length === 0) {
        setAnalyticsData({})
        return
      }

      try {
        setIsLoadingData(true)
        setError('')

        // Progressive loading: fetch stats first (fast)
        const statsData = await analytics.getResponseTimes(auth.currentWorkspace.id, {
          siteIds: selectedSiteIds(),
          timeRange: timeRange(),
          metrics: 'stats'
        })

        setAnalyticsData(statsData)

        // Then fetch data for active tab
        const tabMetric = getMetricForTab(activeTab())
        if (tabMetric && tabMetric !== 'stats') {
          const tabData = await analytics.getResponseTimes(auth.currentWorkspace.id, {
            siteIds: selectedSiteIds(),
            timeRange: timeRange(),
            metrics: tabMetric
          })

          setAnalyticsData(prev => ({ ...prev, ...tabData }))
        }
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsLoadingData(false)
      }
    }

    // Debounce to avoid too many requests
    const timeoutId = setTimeout(fetchAnalytics, 300)
    onCleanup(() => clearTimeout(timeoutId))
  })

  // Fetch tab-specific data when tab changes
  createEffect(() => {
    const tab = activeTab()
    const metric = getMetricForTab(tab)

    if (!auth.currentWorkspace || selectedSiteIds().length === 0 || !metric || metric === 'stats') {
      return
    }

    // Check if we already have this data
    if (analyticsData()[metric as keyof AnalyticsResponse]) {
      return
    }

    const fetchTabData = async () => {
      try {
        setIsLoadingData(true)
        const tabData = await analytics.getResponseTimes(auth.currentWorkspace!.id, {
          siteIds: selectedSiteIds(),
          timeRange: timeRange(),
          metrics: metric
        })

        setAnalyticsData(prev => ({ ...prev, ...tabData }))
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsLoadingData(false)
      }
    }

    const timeoutId = setTimeout(fetchTabData, 100)
    onCleanup(() => clearTimeout(timeoutId))
  })

  const getMetricForTab = (tab: TabType): string | null => {
    const mapping: Record<TabType, string | null> = {
      overview: 'stats',
      comparison: 'comparison',
      trends: 'timeseries',
      distribution: 'distribution'
    }
    return mapping[tab]
  }

  const handleBack = () => {
    navigate('/')
  }

  const selectedSites = () => {
    const ids = selectedSiteIds()
    return sites().filter(s => ids.includes(s.id))
  }

  const tabs: { value: TabType; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'comparison', label: 'Comparison' },
    { value: 'trends', label: 'Trends' },
    { value: 'distribution', label: 'Distribution' },
  ]

  return (
    <div class="min-h-screen bg-[var(--bg)] transition-theme">
      {/* Header */}
      <header class="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl transition-theme">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 sm:py-4">
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
            <div class="h-5 w-px bg-[var(--border)]" />
            <h1 class="text-lg font-semibold text-[var(--text)]">Response Time Analytics</h1>
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

      <main class="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        <Show when={error()}>
          <div class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error()}
          </div>
        </Show>

        <Show when={isLoadingSites()}>
          <div class="flex items-center justify-center py-20">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--text)] border-t-transparent" />
          </div>
        </Show>

        <Show when={!isLoadingSites()}>
          {/* Controls */}
          <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <div class="lg:col-span-1">
              <SiteSelector
                sites={sites()}
                selectedIds={selectedSiteIds()}
                onSelectionChange={setSelectedSiteIds}
              />
            </div>

            <div class="lg:col-span-3 space-y-6">
              {/* Time Range Selector */}
              <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4">
                <h3 class="text-sm font-medium text-[var(--text)] mb-3">Time Range</h3>
                <TimeRangeSelector selected={timeRange()} onSelect={setTimeRange} />
              </div>

              {/* Tabs */}
              <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 overflow-hidden">
                <div class="border-b border-[var(--border)] px-4">
                  <div class="flex gap-1 overflow-x-auto">
                    <For each={tabs}>
                      {(tab) => (
                        <button
                          onClick={() => setActiveTab(tab.value)}
                          class={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                            activeTab() === tab.value
                              ? 'border-[var(--text)] text-[var(--text)]'
                              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Tab Content */}
                <div class="p-6 min-h-[400px]">
                  <Show when={selectedSiteIds().length === 0}>
                    <div class="text-center py-20 text-[var(--text-tertiary)]">
                      Please select at least one site to view analytics
                    </div>
                  </Show>

                  <Show when={selectedSiteIds().length > 0}>
                    <Show when={isLoadingData()}>
                      <div class="flex items-center justify-center py-20">
                        <div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--text)] border-t-transparent" />
                      </div>
                    </Show>

                    <Show when={!isLoadingData()}>
                      {/* Overview Tab */}
                      <Show when={activeTab() === 'overview'}>
                        <AggregateStats sites={selectedSites()} stats={analyticsData().stats} />
                      </Show>

                      {/* Comparison Tab */}
                      <Show when={activeTab() === 'comparison'}>
                        <ComparisonChart sites={selectedSites()} data={analyticsData().comparison} />
                      </Show>

                      {/* Trends Tab */}
                      <Show when={activeTab() === 'trends'}>
                        <TrendChart sites={selectedSites()} data={analyticsData().timeseries} />
                      </Show>

                      {/* Distribution Tab */}
                      <Show when={activeTab() === 'distribution'}>
                        <DistributionChart sites={selectedSites()} data={analyticsData().distribution} />
                      </Show>
                    </Show>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </main>
    </div>
  )
}
