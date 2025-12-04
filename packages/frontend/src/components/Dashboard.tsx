import { createSignal, createEffect, Show, For, onCleanup } from 'solid-js'
import type { SiteWithDetails, DashboardStats, SseCheckEvent } from '@observer/shared'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { sites } from '../lib/api'
import { sseClient } from '../lib/sse'
import SiteCard from './SiteCard'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import SettingsModal from './SettingsModal'

type FilterStatus = 'all' | 'up' | 'down' | 'slow' | 'ssl'
type ViewMode = 'list' | 'switchboard'

// Track last known SSE status per site (separate from siteList to avoid race conditions)
const lastKnownStatus = new Map<number, string>()

export default function Dashboard() {
  const auth = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [siteList, setSiteList] = createSignal<SiteWithDetails[]>([])
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal('')
  const [search, setSearch] = createSignal('')
  const [filter, setFilter] = createSignal<FilterStatus>('all')
  const [viewMode, setViewMode] = createSignal<ViewMode>('list')
  const [showAddSite, setShowAddSite] = createSignal(false)
  const [showSettings, setShowSettings] = createSignal(false)
  const [isFlashing, setIsFlashing] = createSignal(false)

  // New site form
  const [newSiteName, setNewSiteName] = createSignal('')
  const [newSiteUrl, setNewSiteUrl] = createSignal('')
  const [isAdding, setIsAdding] = createSignal(false)

  const canEdit = () => {
    const role = auth.currentWorkspace?.role
    return role === 'owner' || role === 'editor'
  }

  const fetchSites = async () => {
    if (!auth.currentWorkspace) return
    try {
      setIsLoading(true)
      const data = await sites.list(auth.currentWorkspace.id)
      setSiteList(data)
      // Initialize status tracking for flash detection (only if not already tracked)
      for (const site of data) {
        if (!lastKnownStatus.has(site.id) && site.lastStatus) {
          lastKnownStatus.set(site.id, site.lastStatus)
        }
      }
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch sites when workspace changes and connect to SSE
  createEffect(() => {
    if (auth.currentWorkspace) {
      fetchSites()
      sseClient.connect(auth.currentWorkspace.id)
    }
  })

  // Subscribe to SSE events for real-time updates
  const unsubscribe = sseClient.subscribe((event) => {
    if (event.type === 'check') {
      const checkEvent = event as SseCheckEvent
      console.log('[Dashboard] Received check event:', checkEvent)

      // Check if site just went down using our tracked SSE status (avoids race condition with fetchSites)
      const previousStatus = lastKnownStatus.get(checkEvent.siteId)
      console.log('[Dashboard] SSE status transition:', previousStatus, '->', checkEvent.status)

      if (previousStatus && previousStatus !== 'down' && checkEvent.status === 'down') {
        // Trigger flash effect
        console.log('[Dashboard] TRIGGERING FLASH!')
        setIsFlashing(true)
        setTimeout(() => setIsFlashing(false), 5000)
      }

      // Update our tracked status
      lastKnownStatus.set(checkEvent.siteId, checkEvent.status)

      // Update the site in the list with new data
      setSiteList((prev) =>
        prev.map((site) =>
          site.id === checkEvent.siteId
            ? {
                ...site,
                lastStatus: checkEvent.status,
                lastResponseTime: checkEvent.responseTime,
                isSlow: checkEvent.isSlow,
                lastCheckedAt: new Date().toISOString(),
                responseHistory: [...site.responseHistory.slice(-19), checkEvent.responseTime || 0],
              }
            : site
        )
      )
    }
  })

  // Auto-refresh every 60 seconds (as fallback, SSE should handle most updates)
  const refreshInterval = setInterval(fetchSites, 60000)

  onCleanup(() => {
    clearInterval(refreshInterval)
    unsubscribe()
    sseClient.disconnect()
  })

  const stats = (): DashboardStats => {
    const list = siteList()
    return {
      total: list.length,
      up: list.filter((s) => s.lastStatus === 'up' && !s.isSlow).length,
      down: list.filter((s) => s.lastStatus === 'down').length,
      slow: list.filter((s) => s.isSlow).length,
      sslWarnings: list.filter((s) => s.sslDaysRemaining !== null && s.sslDaysRemaining < 14).length,
    }
  }

  const filteredSites = () => {
    let result = siteList()

    // Apply search
    if (search()) {
      const s = search().toLowerCase()
      result = result.filter((site) => site.name.toLowerCase().includes(s) || site.url.toLowerCase().includes(s))
    }

    // Apply filter
    switch (filter()) {
      case 'up':
        result = result.filter((s) => s.lastStatus === 'up' && !s.isSlow)
        break
      case 'down':
        result = result.filter((s) => s.lastStatus === 'down')
        break
      case 'slow':
        result = result.filter((s) => s.isSlow)
        break
      case 'ssl':
        result = result.filter((s) => s.sslDaysRemaining !== null && s.sslDaysRemaining < 14)
        break
    }

    // Sort: starred first, then by name
    result = result.sort((a, b) => {
      if (a.isStarred !== b.isStarred) return b.isStarred ? 1 : -1
      return a.name.localeCompare(b.name)
    })

    return result
  }

  // Always group by status
  const groupedSites = () => {
    const filtered = filteredSites()
    return {
      Down: filtered.filter((s) => s.lastStatus === 'down'),
      Slow: filtered.filter((s) => s.isSlow && s.lastStatus !== 'down'),
      Up: filtered.filter((s) => s.lastStatus === 'up' && !s.isSlow),
    }
  }

  const handleAddSite = async (e: Event) => {
    e.preventDefault()
    if (!auth.currentWorkspace || !newSiteName() || !newSiteUrl()) return

    setIsAdding(true)
    try {
      let url = newSiteUrl()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`
      }

      await sites.create(auth.currentWorkspace.id, {
        name: newSiteName(),
        url,
      })

      setNewSiteName('')
      setNewSiteUrl('')
      setShowAddSite(false)
      fetchSites()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleLogout = async () => {
    await auth.logout()
    window.location.href = '/login'
  }

  // Minimal switchboard tile - just a dot and name
  const SwitchboardTile = (props: { site: SiteWithDetails }) => {
    const getStatusColor = () => {
      if (props.site.lastStatus === 'down') return 'bg-red-500'
      if (props.site.isSlow) return 'bg-amber-500'
      return 'bg-emerald-500'
    }

    const isAlert = props.site.lastStatus === 'down' || props.site.isSlow

    return (
      <div
        class="flex items-center gap-1.5 py-0.5 cursor-default"
        title={`${props.site.url}${props.site.lastResponseTime ? ' • ' + props.site.lastResponseTime + 'ms' : ''}`}
      >
        <div class="relative flex-shrink-0">
          <div class={`h-2 w-2 rounded-full ${getStatusColor()}`} />
          <Show when={isAlert}>
            <div class={`absolute inset-0 h-2 w-2 rounded-full ${getStatusColor()} animate-ping opacity-75`} />
          </Show>
        </div>
        <span class="text-xs text-[var(--text-secondary)] truncate">{props.site.name}</span>
      </div>
    )
  }

  return (
    <div class="min-h-screen bg-[var(--bg)] transition-theme relative">
      {/* Flash overlay for site down alerts */}
      <Show when={isFlashing()}>
        <div class="fixed inset-0 z-[9999] pointer-events-none animate-flash-red" />
      </Show>
      {/* Header */}
      <header class="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl transition-theme">
        <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div class="flex items-center gap-6">
            {/* Logo */}
            <div class="flex items-center gap-3">
              <div class="relative">
                <div class="h-8 w-8 rounded-full bg-[var(--text)]" />
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="h-3 w-3 rounded-full bg-[var(--bg)]" />
                </div>
              </div>
              <span class="text-lg font-medium text-[var(--text)]">Observer</span>
            </div>
            <WorkspaceSwitcher />
          </div>

          <div class="flex items-center gap-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
              title={theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
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
            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              class="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
              title="Settings"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <div class="h-5 w-px bg-[var(--border)]" />
            <span class="text-sm text-[var(--text-secondary)]">{auth.user?.name}</span>
            <button
              onClick={handleLogout}
              class="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)] hover:border-[var(--text-tertiary)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main class="mx-auto max-w-6xl px-6 py-8">
        {/* Stats Cards */}
        <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <button
            onClick={() => setFilter('all')}
            class={`group rounded-xl border p-4 text-left transition-all ${
              filter() === 'all'
                ? 'border-[var(--border)] bg-[var(--bg-tertiary)]/50'
                : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:border-[var(--border)]'
            }`}
          >
            <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total</div>
            <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{stats().total}</div>
          </button>

          <button
            onClick={() => setFilter('up')}
            class={`group rounded-xl border p-4 text-left transition-all ${
              filter() === 'up'
                ? 'border-[var(--border)] bg-[var(--bg-tertiary)]/50'
                : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:border-[var(--border)]'
            }`}
          >
            <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Up</div>
            <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{stats().up}</div>
          </button>

          <button
            onClick={() => setFilter('slow')}
            class={`group rounded-xl border p-4 text-left transition-all ${
              filter() === 'slow'
                ? 'border-[var(--border)] bg-[var(--bg-tertiary)]/50'
                : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:border-[var(--border)]'
            }`}
          >
            <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Slow</div>
            <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{stats().slow}</div>
          </button>

          <button
            onClick={() => setFilter('down')}
            class={`group rounded-xl border p-4 text-left transition-all ${
              filter() === 'down'
                ? 'border-[var(--border)] bg-[var(--bg-tertiary)]/50'
                : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:border-[var(--border)]'
            }`}
          >
            <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Down</div>
            <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{stats().down}</div>
          </button>

          <button
            onClick={() => setFilter('ssl')}
            class={`group rounded-xl border p-4 text-left transition-all ${
              filter() === 'ssl'
                ? 'border-[var(--border)] bg-[var(--bg-tertiary)]/50'
                : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:border-[var(--border)]'
            }`}
          >
            <div class="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">SSL</div>
            <div class="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{stats().sslWarnings}</div>
          </button>
        </div>

        {/* Toolbar */}
        <div class="mb-6 flex flex-wrap items-center gap-4">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search sites..."
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              class="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] py-2 pl-10 pr-4 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* View Mode Toggle */}
          <div class="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-1">
            <button
              onClick={() => setViewMode('list')}
              class={`rounded-md px-3 py-1.5 text-sm transition-all ${
                viewMode() === 'list'
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text)]'
              }`}
              title="List View"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('switchboard')}
              class={`rounded-md px-3 py-1.5 text-sm transition-all ${
                viewMode() === 'switchboard'
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text)]'
              }`}
              title="Switchboard View"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
          </div>

          <Show when={canEdit()}>
            <button
              onClick={() => setShowAddSite(true)}
              class="flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)] hover:border-[var(--text-tertiary)]"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Site
            </button>
          </Show>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error()}
          </div>
        </Show>

        {/* Loading */}
        <Show when={isLoading() && siteList().length === 0}>
          <div class="flex items-center justify-center py-20">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--text)] border-t-transparent" />
          </div>
        </Show>

        {/* Sites List / Switchboard View */}
        <Show when={!isLoading() || siteList().length > 0}>
          <Show when={filteredSites().length === 0}>
            <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-16 text-center">
              <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-tertiary)]">
                <svg class="h-6 w-6 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </div>
              <p class="text-[var(--text-secondary)]">
                {siteList().length === 0 ? 'No sites yet. Add your first site to start monitoring.' : 'No sites match your filters.'}
              </p>
            </div>
          </Show>

          {/* List View */}
          <Show when={viewMode() === 'list'}>
            <For each={Object.entries(groupedSites())}>
              {([group, groupSites]) => (
                <Show when={(groupSites as SiteWithDetails[]).length > 0}>
                  <h3 class="mb-3 mt-8 first:mt-0 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{group}</h3>
                  <div class="space-y-2">
                    <For each={groupSites as SiteWithDetails[]}>
                      {(site) => (
                        <SiteCard
                          site={site}
                          workspaceId={auth.currentWorkspace!.id}
                          userRole={auth.currentWorkspace!.role}
                          onUpdate={fetchSites}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              )}
            </For>
          </Show>

          {/* Switchboard View */}
          <Show when={viewMode() === 'switchboard' && filteredSites().length > 0}>
            <For each={Object.entries(groupedSites())}>
              {([group, groupSites]) => (
                <Show when={(groupSites as SiteWithDetails[]).length > 0}>
                  <div class="mb-4 last:mb-0">
                    <h3 class="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{group}</h3>
                    <div class="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-x-6">
                      <For each={groupSites as SiteWithDetails[]}>
                        {(site) => <SwitchboardTile site={site} />}
                      </For>
                    </div>
                  </div>
                </Show>
              )}
            </For>
          </Show>
        </Show>
      </main>

      {/* Add Site Modal */}
      <Show when={showAddSite()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/80 backdrop-blur-sm">
          <div class="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
            <h2 class="mb-6 text-lg font-medium text-[var(--text)]">Add new site</h2>
            <form onSubmit={handleAddSite} class="space-y-4">
              <div>
                <label class="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Site Name</label>
                <input
                  type="text"
                  value={newSiteName()}
                  onInput={(e) => setNewSiteName(e.currentTarget.value)}
                  placeholder="My Website"
                  class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3 text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label class="mb-2 block text-sm font-medium text-[var(--text-secondary)]">URL</label>
                <input
                  type="text"
                  value={newSiteUrl()}
                  onInput={(e) => setNewSiteUrl(e.currentTarget.value)}
                  placeholder="https://example.com"
                  class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3 text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                  required
                />
              </div>
              <div class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSite(false)}
                  class="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)] hover:border-[var(--text-tertiary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding()}
                  class="rounded-full border border-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
                >
                  {isAdding() ? 'Adding...' : 'Add Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings()}
        onClose={() => setShowSettings(false)}
      />
    </div>
  )
}
