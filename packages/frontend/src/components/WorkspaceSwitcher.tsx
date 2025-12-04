import { createSignal, Show, For } from 'solid-js'
import type { WorkspaceWithRole } from '@observer/shared'
import { useAuth } from '../lib/auth'

export default function WorkspaceSwitcher() {
  const auth = useAuth()
  const [isOpen, setIsOpen] = createSignal(false)

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-[var(--accent)]/20 text-[var(--accent)]'
      case 'editor':
        return 'bg-blue-500/20 text-blue-400'
      case 'guest':
        return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
      default:
        return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
    }
  }

  const handleSelect = (workspace: WorkspaceWithRole) => {
    auth.setCurrentWorkspace(workspace)
    setIsOpen(false)
  }

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text)] transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-hover)]"
      >
        <Show when={auth.currentWorkspace} fallback={<span class="text-[var(--text-secondary)]">Select Workspace</span>}>
          <span class="max-w-[150px] truncate">{auth.currentWorkspace!.name}</span>
          <span class={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getRoleBadge(auth.currentWorkspace!.role)}`}>
            {auth.currentWorkspace!.role}
          </span>
        </Show>
        <svg
          class={`h-4 w-4 text-[var(--text-tertiary)] transition-transform ${isOpen() ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Show when={isOpen()}>
        <div class="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-2 shadow-2xl">
          <For each={auth.workspaces}>
            {(workspace) => (
              <button
                onClick={() => handleSelect(workspace)}
                class={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)] ${
                  workspace.id === auth.currentWorkspace?.id ? 'bg-[var(--bg-hover)]' : ''
                }`}
              >
                <span class="truncate text-[var(--text)]">{workspace.name}</span>
                <span class={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getRoleBadge(workspace.role)}`}>
                  {workspace.role}
                </span>
              </button>
            )}
          </For>

        </div>
      </Show>

      {/* Click outside to close */}
      <Show when={isOpen()}>
        <div class="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      </Show>
    </div>
  )
}
