import { createSignal, Show } from 'solid-js'
import type { SiteWithDetails, WorkspaceRole } from '@observer/shared'
import { sites } from '../lib/api'
import Sparkline from './Sparkline'

interface SiteCardProps {
  site: SiteWithDetails
  workspaceId: number
  userRole: WorkspaceRole
  onUpdate: () => void
  isNew?: boolean
}

export default function SiteCard(props: SiteCardProps) {
  const [isChecking, setIsChecking] = createSignal(false)
  const [isSimulating, setIsSimulating] = createSignal(false)
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false)
  const [canClosePopup, setCanClosePopup] = createSignal(false)
  const [copied, setCopied] = createSignal<string | null>(null)

  const openDeleteConfirm = () => {
    setShowDeleteConfirm(true)
    setCanClosePopup(false)
    // Delay before backdrop can close the popup (prevents accidental close)
    setTimeout(() => setCanClosePopup(true), 200)
  }

  const closeDeleteConfirm = () => {
    if (canClosePopup()) {
      setShowDeleteConfirm(false)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

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

  const handleDelete = async () => {
    if (isDeleting()) return
    setIsDeleting(true)
    try {
      await sites.delete(props.workspaceId, props.site.id)
      setShowDeleteConfirm(false)
      props.onUpdate()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const CopyButton = (props: { text: string; label: string }) => (
    <button
      onClick={() => copyToClipboard(props.text, props.label)}
      class="ml-1 p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
      title={copied() === props.label ? 'Copied!' : `Copy ${props.label}`}
    >
      <Show when={copied() === props.label} fallback={
        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      }>
        <svg class="h-3 w-3 text-[#10a37f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </Show>
    </button>
  )

  const getStatusStyles = () => {
    if (props.site.lastStatus === 'down') return {
      bar: 'bg-red-500',
      glow: 'shadow-[0_0_12px_rgba(239,68,68,0.6)]',
      animation: 'animate-pulse'
    }
    if (props.site.isSlow) return {
      bar: 'bg-amber-500',
      glow: 'shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      animation: 'animate-[pulse_3s_ease-in-out_infinite]'
    }
    return {
      bar: 'bg-emerald-500',
      glow: '',
      animation: ''
    }
  }

  const statusStyles = getStatusStyles()

  return (
    <div class={`group relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-4 pl-5 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-secondary)] overflow-hidden ${props.isNew ? 'animate-slide-in' : ''}`}>
      {/* Status indicator bar - pulses bright green when new */}
      <div class={`absolute left-0 top-0 bottom-0 ${props.isNew ? 'w-1.5 bg-[#10a37f] shadow-[0_0_12px_rgba(16,163,127,0.8)] animate-[newSitePulse_1s_ease-in-out_3]' : `w-1 ${statusStyles.bar} ${statusStyles.glow} ${statusStyles.animation}`}`} />

      {/* Header */}
      <div class="flex items-center gap-4 mb-3">
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
          <div class="flex items-center text-sm text-[var(--text-tertiary)]">
            <a href={props.site.url} target="_blank" rel="noopener noreferrer" class="truncate hover:text-[var(--text)] hover:underline">{props.site.url}</a>
            <CopyButton text={props.site.url} label="url" />
          </div>
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
      </div>

      {/* Stats Grid */}
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <div class="flex items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)]/50 px-2.5 py-1.5">
          <span class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Uptime</span>
          <span class="font-mono text-xs font-medium tabular-nums text-[var(--text)]">
            {props.site.uptime !== null ? `${props.site.uptime.toFixed(1)}%` : '-'}
          </span>
        </div>
        <div class="flex items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)]/50 px-2.5 py-1.5">
          <span class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">Avg</span>
          <span class="font-mono text-xs font-medium tabular-nums text-[var(--text)]">
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
        <div class={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
          props.site.sslDaysRemaining !== null && props.site.sslDaysRemaining < 14
            ? 'bg-orange-500/10'
            : 'bg-[var(--bg-tertiary)]/50'
        }`}>
          <span class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">SSL</span>
          <span class={`font-mono text-xs font-medium tabular-nums ${
            props.site.sslDaysRemaining !== null && props.site.sslDaysRemaining < 14
              ? 'text-orange-500'
              : 'text-[var(--text)]'
          }`}>
            {props.site.sslDaysRemaining !== null ? `${props.site.sslDaysRemaining}d` : '-'}
          </span>
        </div>
        <Show when={props.site.ipAddress}>
          <div class="flex items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)]/50 px-2.5 py-1.5">
            <span class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">IP</span>
            <span class="font-mono text-xs text-[var(--text)]">{props.site.ipAddress}</span>
            <CopyButton text={props.site.ipAddress!} label="ip" />
          </div>
        </Show>
        <Show when={props.site.nameservers}>
          <div class="flex items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)]/50 px-2.5 py-1.5">
            <span class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">NS</span>
            <div class="flex items-center gap-2">
              {props.site.nameservers!.split(',').map((ns, i) => (
                <span class="flex items-center text-xs text-[var(--text)]">
                  {ns.trim()}
                  <CopyButton text={ns.trim()} label={`ns-${i}`} />
                </span>
              ))}
            </div>
          </div>
        </Show>
        <Show when={props.site.cmsName}>
          <div class="flex items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)]/50 px-2.5 py-1.5">
            <span class="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">CMS</span>
            <span class="text-xs text-[var(--text)]">
              {props.site.cmsName}{props.site.cmsVersion && ` ${props.site.cmsVersion}`}
            </span>
          </div>
        </Show>
      </div>

      {/* Actions */}
      <Show when={canEdit()}>
        <div class="flex items-center gap-2">
          <button
            onClick={handleCheck}
            disabled={isChecking()}
            class="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg-hover)] hover:border-[var(--text-tertiary)] disabled:opacity-50"
          >
            {isChecking() ? 'Checking...' : 'Check'}
          </button>
          <button
            onClick={handleSimulateDown}
            disabled={isSimulating()}
            class="rounded-full border border-red-500/50 px-3 py-1 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500 disabled:opacity-50"
          >
            {isSimulating() ? 'Simulating...' : props.site.lastStatus === 'down' ? 'Simulate Up' : 'Simulate Down'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openDeleteConfirm() }}
            class="rounded-full border border-red-500/50 px-3 py-1 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500"
          >
            Delete
          </button>
        </div>
      </Show>

      {/* Delete Confirmation Popup */}
      <Show when={showDeleteConfirm()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onMouseDown={closeDeleteConfirm} />
          <div class="relative z-10 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-2xl">
            <h3 class="text-lg font-semibold text-[var(--text)] mb-2">Delete Site</h3>
            <p class="text-sm text-[var(--text-secondary)] mb-6">
              Are you sure you want to delete <span class="font-medium text-[var(--text)]">{props.site.name}</span>? This action cannot be undone.
            </p>
            <div class="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                class="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting()}
                class="rounded-full bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting() ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
