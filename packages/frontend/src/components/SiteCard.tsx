import { createSignal, Show } from 'solid-js'
import type { SiteWithDetails, WorkspaceRole } from '@observer/shared'
import { sites } from '../lib/api'
import Sparkline from './Sparkline'

interface SiteCardProps {
  site: SiteWithDetails
  workspaceId: number
  userRole: WorkspaceRole
  onUpdate: () => void
}

export default function SiteCard(props: SiteCardProps) {
  const [isExpanded, setIsExpanded] = createSignal(false)
  const [isChecking, setIsChecking] = createSignal(false)
  const [isSimulating, setIsSimulating] = createSignal(false)

  const canEdit = () => props.userRole === 'owner' || props.userRole === 'editor'

  const getStatusColor = () => {
    if (props.site.lastStatus === 'down') return 'bg-red-500'
    if (props.site.isSlow) return 'bg-amber-500'
    return 'bg-[#10a37f]'
  }

  const getStatusGlow = () => {
    if (props.site.lastStatus === 'down') return 'shadow-[0_0_8px_rgba(239,68,68,0.5)]'
    if (props.site.isSlow) return 'shadow-[0_0_8px_rgba(245,158,11,0.5)]'
    return ''
  }

  const getSparklineColor = () => {
    if (props.site.lastStatus === 'down') return '#ef4444'
    if (props.site.isSlow) return '#f59e0b'
    return '#10a37f'
  }

  const formatResponseTime = (ms: number | null) => {
    if (ms === null) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatLastChecked = (date: string | null) => {
    if (!date) return 'Never'
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  const handleCheck = async (e: Event) => {
    e.stopPropagation()
    if (isChecking()) return
    setIsChecking(true)
    try {
      await sites.check(props.workspaceId, props.site.id)
      props.onUpdate()
    } catch (err) {
      console.error('Check failed:', err)
    } finally {
      setIsChecking(false)
    }
  }

  const handleSimulateDown = async (e: Event) => {
    e.stopPropagation()
    if (isSimulating()) return
    setIsSimulating(true)
    try {
      await sites.simulateDown(props.workspaceId, props.site.id)
      props.onUpdate()
    } catch (err) {
      console.error('Simulate down failed:', err)
    } finally {
      setIsSimulating(false)
    }
  }

  return (
    <div
      class="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-secondary)]"
      onClick={() => setIsExpanded(!isExpanded())}
    >
      {/* Collapsed View */}
      <div class="flex cursor-pointer items-center gap-4 px-4 py-3">
        {/* Status indicator */}
        <div class={`h-2.5 w-2.5 rounded-full ${getStatusColor()} ${getStatusGlow()}`} />

        {/* Site info */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-[var(--text)] truncate">{props.site.name}</span>
            <Show when={props.site.isStarred}>
              <svg class="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </Show>
            <Show when={props.site.isSla}>
              <span class="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">SLA</span>
            </Show>
          </div>
          <div class="text-sm text-[var(--text-tertiary)] truncate">{props.site.url}</div>
        </div>

        {/* Sparkline */}
        <div class="hidden sm:block w-28">
          <Show when={props.site.responseHistory.length > 0}>
            <Sparkline data={props.site.responseHistory} color={getSparklineColor()} height={24} />
          </Show>
        </div>

        {/* Response time */}
        <div class="text-right min-w-[80px]">
          <div class="font-mono text-sm text-[var(--text)] tabular-nums">
            {formatResponseTime(props.site.lastResponseTime)}
          </div>
          <div class="text-xs text-[var(--text-tertiary)]">{formatLastChecked(props.site.lastCheckedAt)}</div>
        </div>

        {/* Expand icon */}
        <svg
          class={`h-4 w-4 text-[var(--text-tertiary)] transition-transform ${isExpanded() ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded View */}
      <Show when={isExpanded()}>
        <div class="border-t border-[var(--border)] px-4 py-3 text-sm">
          {/* Row 1: Stats */}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-6">
              <div class="flex items-center gap-2">
                <span class="text-[var(--text-tertiary)]">Uptime</span>
                <span class="font-medium tabular-nums text-[var(--text)]">
                  {props.site.uptime !== null ? `${props.site.uptime.toFixed(1)}%` : '-'}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[var(--text-tertiary)]">Avg</span>
                <span class="font-medium tabular-nums text-[var(--text)]">
                  {props.site.responseHistory.length > 0
                    ? formatResponseTime(
                        Math.round(
                          props.site.responseHistory.reduce((a, b) => a + b, 0) /
                            props.site.responseHistory.length
                        )
                      )
                    : '-'}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[var(--text-tertiary)]">SSL</span>
                <span class={`font-medium tabular-nums ${
                  props.site.sslDaysRemaining !== null && props.site.sslDaysRemaining < 14
                    ? 'text-orange-500'
                    : 'text-[var(--text)]'
                }`}>
                  {props.site.sslDaysRemaining !== null ? `${props.site.sslDaysRemaining}d` : '-'}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[var(--text-tertiary)]">IP</span>
                <span class="font-mono text-[var(--text)]">{props.site.ipAddress || '-'}</span>
              </div>
            </div>

            {/* Actions */}
            <div class="flex items-center gap-3">
              <Show when={canEdit()}>
                <button
                  onClick={handleCheck}
                  disabled={isChecking()}
                  class="text-[var(--text-secondary)] hover:text-[var(--text)] disabled:opacity-50"
                >
                  {isChecking() ? 'Checking...' : 'Check'}
                </button>
                <button
                  onClick={handleSimulateDown}
                  disabled={isSimulating()}
                  class="text-orange-500 hover:text-orange-400 disabled:opacity-50"
                >
                  {isSimulating() ? 'Simulating...' : props.site.lastStatus === 'down' ? 'Simulate Up' : 'Simulate Down'}
                </button>
              </Show>
              <a
                href={props.site.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                class="text-[var(--text-secondary)] hover:text-[var(--text)]"
              >
                Visit ↗
              </a>
            </div>
          </div>

          {/* Row 2: NS and CMS */}
          <Show when={props.site.nameservers || props.site.cmsName}>
            <div class="flex items-center gap-6 mt-2">
              <Show when={props.site.nameservers}>
                <div class="flex items-center gap-2">
                  <span class="text-[var(--text-tertiary)]">NS</span>
                  <span class="text-[var(--text)]">{props.site.nameservers}</span>
                </div>
              </Show>
              <Show when={props.site.cmsName}>
                <div class="flex items-center gap-2">
                  <span class="text-[var(--text-tertiary)]">CMS</span>
                  <span class="text-[var(--text)]">
                    {props.site.cmsName}{props.site.cmsVersion && ` ${props.site.cmsVersion}`}
                  </span>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
