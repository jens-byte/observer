import { For, Show } from 'solid-js'
import type { SiteWithDetails } from '@observer/shared'

interface SiteSelectorProps {
  sites: SiteWithDetails[]
  selectedIds: number[]
  onSelectionChange: (siteIds: number[]) => void
}

export default function SiteSelector(props: SiteSelectorProps) {
  const toggleSite = (siteId: number) => {
    const newSelection = props.selectedIds.includes(siteId)
      ? props.selectedIds.filter(id => id !== siteId)
      : [...props.selectedIds, siteId]
    props.onSelectionChange(newSelection)
  }

  const selectAll = () => {
    props.onSelectionChange(props.sites.map(s => s.id))
  }

  const deselectAll = () => {
    props.onSelectionChange([])
  }

  const allSelected = () => props.sites.length > 0 && props.selectedIds.length === props.sites.length

  return (
    <div class="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/50 p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-medium text-[var(--text)]">Select Sites</h3>
        <div class="flex gap-2">
          <button
            onClick={selectAll}
            class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] underline"
          >
            Select All
          </button>
          <span class="text-[var(--text-tertiary)]">|</span>
          <button
            onClick={deselectAll}
            class="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] underline"
          >
            Deselect All
          </button>
        </div>
      </div>

      <Show when={props.sites.length === 0} fallback={
        <div class="max-h-64 overflow-y-auto space-y-2">
          <For each={props.sites}>
            {(site) => (
              <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={props.selectedIds.includes(site.id)}
                  onChange={() => toggleSite(site.id)}
                  class="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
                />
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <div class={`h-2 w-2 rounded-full flex-shrink-0 ${
                    site.lastStatus === 'down' ? 'bg-red-500' :
                    site.isSlow ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span class="text-sm text-[var(--text)] truncate">{site.name}</span>
                </div>
              </label>
            )}
          </For>
        </div>
      }>
        <div class="text-sm text-[var(--text-tertiary)] text-center py-4">
          No sites available
        </div>
      </Show>

      <Show when={props.selectedIds.length > 0}>
        <div class="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-tertiary)]">
          {props.selectedIds.length} site{props.selectedIds.length !== 1 ? 's' : ''} selected
        </div>
      </Show>
    </div>
  )
}
