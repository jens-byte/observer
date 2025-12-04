import { createSignal, createEffect, Show, For } from 'solid-js'
import type { WorkspaceMember, WorkspaceInvite, WorkspaceRole } from '@observer/shared'
import { useAuth } from '../lib/auth'
import { settings, workspaces } from '../lib/api'

type SettingsTab = 'notifications' | 'workspace'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

export default function SettingsModal(props: SettingsModalProps) {
  const auth = useAuth()
  const [activeTab, setActiveTab] = createSignal<SettingsTab>(props.initialTab || 'notifications')
  const [isLoading, setIsLoading] = createSignal(true)
  const [isSaving, setIsSaving] = createSignal(false)
  const [error, setError] = createSignal('')
  const [success, setSuccess] = createSignal('')

  // Notification settings
  const [emailEnabled, setEmailEnabled] = createSignal(false)
  const [emailTo, setEmailTo] = createSignal('')
  const [emailSmtpHost, setEmailSmtpHost] = createSignal('')
  const [emailSmtpPort, setEmailSmtpPort] = createSignal(587)
  const [emailSmtpUser, setEmailSmtpUser] = createSignal('')
  const [emailSmtpPass, setEmailSmtpPass] = createSignal('')
  const [webhookEnabled, setWebhookEnabled] = createSignal(false)
  const [webhookUrl, setWebhookUrl] = createSignal('')
  const [webhookDelaySeconds, setWebhookDelaySeconds] = createSignal(0)
  const [sslWarningDays, setSslWarningDays] = createSignal(14)
  const [slackBotToken, setSlackBotToken] = createSignal('')
  const [slackChannelId, setSlackChannelId] = createSignal('')

  // Workspace settings
  const [members, setMembers] = createSignal<WorkspaceMember[]>([])
  const [invites, setInvites] = createSignal<WorkspaceInvite[]>([])
  const [inviteEmail, setInviteEmail] = createSignal('')
  const [inviteRole, setInviteRole] = createSignal<'editor' | 'guest'>('editor')
  const [isInviting, setIsInviting] = createSignal(false)
  const [workspaceName, setWorkspaceName] = createSignal('')
  const [isSavingWorkspace, setIsSavingWorkspace] = createSignal(false)

  const canEdit = () => {
    const role = auth.currentWorkspace?.role
    return role === 'owner' || role === 'editor'
  }

  const isOwner = () => auth.currentWorkspace?.role === 'owner'
  const canInvite = () => isOwner() || auth.currentWorkspace?.role === 'editor'
  const isGuest = () => auth.currentWorkspace?.role === 'guest'

  const fetchSettings = async () => {
    if (!auth.currentWorkspace) return
    try {
      setIsLoading(true)
      const data = await settings.get(auth.currentWorkspace.id)
      setEmailEnabled(data.emailEnabled)
      setEmailTo(data.emailTo || '')
      setEmailSmtpHost(data.emailSmtpHost || '')
      setEmailSmtpPort(data.emailSmtpPort)
      setEmailSmtpUser(data.emailSmtpUser || '')
      setEmailSmtpPass(data.emailSmtpPass || '')
      setWebhookEnabled(data.webhookEnabled)
      setWebhookUrl(data.webhookUrl || '')
      setWebhookDelaySeconds(data.webhookDelaySeconds)
      setSslWarningDays(data.sslWarningDays)
      setSlackBotToken(data.slackBotToken || '')
      setSlackChannelId(data.slackChannelId || '')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWorkspaceData = async () => {
    if (!auth.currentWorkspace) return
    try {
      setIsLoading(true)
      setWorkspaceName(auth.currentWorkspace.name)
      const [membersData, invitesData] = await Promise.all([
        workspaces.members(auth.currentWorkspace.id),
        workspaces.invites(auth.currentWorkspace.id),
      ])
      setMembers(membersData)
      setInvites(invitesData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveWorkspaceName = async () => {
    if (!auth.currentWorkspace || !isOwner()) return
    const newName = workspaceName().trim()
    if (!newName || newName === auth.currentWorkspace.name) return

    setIsSavingWorkspace(true)
    setError('')
    setSuccess('')

    try {
      await workspaces.update(auth.currentWorkspace.id, { name: newName })
      await auth.refreshAuth()
      setSuccess('Workspace name updated')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSavingWorkspace(false)
    }
  }

  createEffect(() => {
    if (props.isOpen && auth.currentWorkspace) {
      setError('')
      setSuccess('')
      if (activeTab() === 'notifications' && !isGuest()) {
        fetchSettings()
      } else {
        fetchWorkspaceData()
      }
    }
  })

  createEffect(() => {
    if (props.isOpen) {
      setActiveTab(props.initialTab || (isGuest() ? 'workspace' : 'notifications'))
    }
  })

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
    setError('')
    setSuccess('')
    if (tab === 'notifications') {
      fetchSettings()
    } else {
      fetchWorkspaceData()
    }
  }

  const handleSaveNotifications = async () => {
    if (!auth.currentWorkspace || !canEdit()) return

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      await settings.update(auth.currentWorkspace.id, {
        emailEnabled: emailEnabled(),
        emailTo: emailTo() || null,
        emailSmtpHost: emailSmtpHost() || null,
        emailSmtpPort: emailSmtpPort(),
        emailSmtpUser: emailSmtpUser() || null,
        emailSmtpPass: emailSmtpPass() || null,
        webhookEnabled: webhookEnabled(),
        webhookUrl: webhookUrl() || null,
        webhookDelaySeconds: webhookDelaySeconds(),
        sslWarningDays: sslWarningDays(),
        slackBotToken: slackBotToken() || null,
        slackChannelId: slackChannelId() || null,
      })
      setSuccess('Settings saved')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!auth.currentWorkspace) return
    try {
      await settings.testEmail(auth.currentWorkspace.id)
      setSuccess('Test email sent')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleTestWebhook = async () => {
    if (!auth.currentWorkspace) return
    try {
      await settings.testWebhook(auth.currentWorkspace.id)
      setSuccess('Test webhook sent')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleInvite = async (e: Event) => {
    e.preventDefault()
    if (!auth.currentWorkspace || !inviteEmail()) return

    setIsInviting(true)
    setError('')
    setSuccess('')

    try {
      await workspaces.invite(auth.currentWorkspace.id, {
        email: inviteEmail(),
        role: inviteRole(),
      })
      setInviteEmail('')
      setSuccess('Invite sent')
      fetchWorkspaceData()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsInviting(false)
    }
  }

  const handleCancelInvite = async (inviteId: number) => {
    if (!auth.currentWorkspace) return
    try {
      await workspaces.cancelInvite(auth.currentWorkspace.id, inviteId)
      fetchWorkspaceData()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleRemoveMember = async (memberId: number) => {
    if (!auth.currentWorkspace) return
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      await workspaces.removeMember(auth.currentWorkspace.id, memberId)
      fetchWorkspaceData()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleChangeRole = async (memberId: number, newRole: WorkspaceRole) => {
    if (!auth.currentWorkspace) return
    try {
      await workspaces.updateMemberRole(auth.currentWorkspace.id, memberId, newRole)
      fetchWorkspaceData()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleLeaveWorkspace = async () => {
    if (!auth.currentWorkspace) return
    if (!confirm('Are you sure you want to leave this workspace?')) return

    try {
      const myMember = members().find((m) => m.userId === auth.user?.id)
      if (myMember) {
        await workspaces.removeMember(auth.currentWorkspace.id, myMember.id)
        await auth.refreshAuth()
        props.onClose()
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

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

  const menuItems = [
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', hidden: isGuest() },
    { id: 'workspace' as SettingsTab, label: 'Workspace', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', hidden: false },
  ]

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />

      {/* Modal */}
      <div class="relative z-10 flex h-[600px] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        {/* Left Sidebar */}
        <div class="w-56 flex-shrink-0 border-r border-[var(--border)] p-4">
          <button
            onClick={props.onClose}
            class="mb-6 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <nav class="space-y-1">
            <For each={menuItems.filter(item => !item.hidden)}>
              {(item) => (
                <button
                  onClick={() => handleTabChange(item.id)}
                  class={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    activeTab() === item.id
                      ? 'bg-[var(--bg-tertiary)] text-[var(--text)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]'
                  }`}
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              )}
            </For>
          </nav>
        </div>

        {/* Right Content */}
        <div class="flex-1 overflow-y-auto">
          <div class="p-6">
            {/* Header */}
            <div class="mb-6 flex items-center justify-between">
              <h2 class="text-xl font-semibold text-[var(--text)]">
                {activeTab() === 'notifications' ? 'Notifications' : auth.currentWorkspace?.name}
              </h2>
              <Show when={activeTab() === 'notifications' && canEdit()}>
                <button
                  onClick={handleSaveNotifications}
                  disabled={isSaving()}
                  class="rounded-full border border-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                >
                  {isSaving() ? 'Saving...' : 'Save'}
                </button>
              </Show>
            </div>

            {/* Messages */}
            <Show when={error()}>
              <div class="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error()}
              </div>
            </Show>

            <Show when={success()}>
              <div class="mb-4 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
                {success()}
              </div>
            </Show>

            {/* Loading */}
            <Show when={isLoading()}>
              <div class="flex items-center justify-center py-12">
                <div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--text)] border-t-transparent" />
              </div>
            </Show>

            {/* Notifications Content */}
            <Show when={!isLoading() && activeTab() === 'notifications'}>
              <div class="space-y-8">
                {/* Email */}
                <section>
                  <div class="mb-4 flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-medium text-[var(--text)]">Email Notifications</h3>
                      <p class="text-xs text-[var(--text-tertiary)]">Receive alerts via email</p>
                    </div>
                    <label class="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={emailEnabled()}
                        onChange={(e) => setEmailEnabled(e.currentTarget.checked)}
                        disabled={!canEdit()}
                        class="peer sr-only"
                      />
                      <div class="h-6 w-11 rounded-full bg-[var(--bg-tertiary)] peer-checked:bg-[var(--accent)] peer-disabled:opacity-50 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  <Show when={emailEnabled()}>
                    <div class="space-y-3">
                      <input
                        type="email"
                        value={emailTo()}
                        onInput={(e) => setEmailTo(e.currentTarget.value)}
                        disabled={!canEdit()}
                        class="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                        placeholder="Send to email"
                      />
                      <div class="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={emailSmtpHost()}
                          onInput={(e) => setEmailSmtpHost(e.currentTarget.value)}
                          disabled={!canEdit()}
                          class="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                          placeholder="SMTP Host"
                        />
                        <input
                          type="number"
                          value={emailSmtpPort()}
                          onInput={(e) => setEmailSmtpPort(parseInt(e.currentTarget.value) || 587)}
                          disabled={!canEdit()}
                          class="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                          placeholder="Port"
                        />
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={emailSmtpUser()}
                          onInput={(e) => setEmailSmtpUser(e.currentTarget.value)}
                          disabled={!canEdit()}
                          class="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                          placeholder="SMTP Username"
                        />
                        <input
                          type="password"
                          value={emailSmtpPass()}
                          onInput={(e) => setEmailSmtpPass(e.currentTarget.value)}
                          disabled={!canEdit()}
                          class="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                          placeholder="SMTP Password"
                        />
                      </div>
                      <Show when={canEdit()}>
                        <button
                          type="button"
                          onClick={handleTestEmail}
                          class="text-xs text-[var(--accent)] hover:underline"
                        >
                          Send test email
                        </button>
                      </Show>
                    </div>
                  </Show>
                </section>

                <div class="border-t border-[var(--border)]" />

                {/* Webhook */}
                <section>
                  <div class="mb-4 flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-medium text-[var(--text)]">Webhook / Slack</h3>
                      <p class="text-xs text-[var(--text-tertiary)]">Send alerts to Slack or webhook</p>
                    </div>
                    <label class="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={webhookEnabled()}
                        onChange={(e) => setWebhookEnabled(e.currentTarget.checked)}
                        disabled={!canEdit()}
                        class="peer sr-only"
                      />
                      <div class="h-6 w-11 rounded-full bg-[var(--bg-tertiary)] peer-checked:bg-[var(--accent)] peer-disabled:opacity-50 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  <Show when={webhookEnabled()}>
                    <div class="space-y-3">
                      <input
                        type="url"
                        value={webhookUrl()}
                        onInput={(e) => setWebhookUrl(e.currentTarget.value)}
                        disabled={!canEdit()}
                        class="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                        placeholder="Webhook URL"
                      />
                      <div class="flex items-center gap-3">
                        <input
                          type="number"
                          value={webhookDelaySeconds()}
                          onInput={(e) => setWebhookDelaySeconds(parseInt(e.currentTarget.value) || 0)}
                          disabled={!canEdit()}
                          class="w-24 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                          min="0"
                        />
                        <span class="text-xs text-[var(--text-tertiary)]">seconds delay before notification</span>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <input
                          type="password"
                          value={slackBotToken()}
                          onInput={(e) => setSlackBotToken(e.currentTarget.value)}
                          disabled={!canEdit()}
                          class="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                          placeholder="Slack Bot Token (for screenshots)"
                        />
                        <input
                          type="text"
                          value={slackChannelId()}
                          onInput={(e) => setSlackChannelId(e.currentTarget.value)}
                          disabled={!canEdit()}
                          class="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                          placeholder="Channel ID"
                        />
                      </div>
                      <Show when={canEdit()}>
                        <button
                          type="button"
                          onClick={handleTestWebhook}
                          class="text-xs text-[var(--accent)] hover:underline"
                        >
                          Send test webhook
                        </button>
                      </Show>
                    </div>
                  </Show>
                </section>

                <div class="border-t border-[var(--border)]" />

                {/* SSL */}
                <section>
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-medium text-[var(--text)]">SSL Warning</h3>
                      <p class="text-xs text-[var(--text-tertiary)]">Days before expiry to warn</p>
                    </div>
                    <input
                      type="number"
                      value={sslWarningDays()}
                      onInput={(e) => setSslWarningDays(parseInt(e.currentTarget.value) || 14)}
                      disabled={!canEdit()}
                      class="w-20 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] text-right focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                      min="1"
                    />
                  </div>
                </section>
              </div>
            </Show>

            {/* Workspace Content */}
            <Show when={!isLoading() && activeTab() === 'workspace'}>
              <div class="space-y-6">
                {/* Workspace Info */}
                <section>
                  <Show when={isOwner()} fallback={
                    <p class="text-sm text-[var(--text-tertiary)] mb-2">/{auth.currentWorkspace?.slug}</p>
                  }>
                    <div class="mb-3">
                      <label class="block text-xs text-[var(--text-tertiary)] mb-1">Workspace Name</label>
                      <div class="flex gap-2">
                        <input
                          type="text"
                          value={workspaceName()}
                          onInput={(e) => setWorkspaceName(e.currentTarget.value)}
                          class="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                        />
                        <button
                          onClick={handleSaveWorkspaceName}
                          disabled={isSavingWorkspace() || workspaceName().trim() === auth.currentWorkspace?.name}
                          class="rounded-full border border-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                        >
                          {isSavingWorkspace() ? '...' : 'Save'}
                        </button>
                      </div>
                    </div>
                    <p class="text-sm text-[var(--text-tertiary)]">/{auth.currentWorkspace?.slug}</p>
                  </Show>
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-sm text-[var(--text-secondary)]">Your role:</span>
                    <span class={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadge(auth.currentWorkspace?.role || '')}`}>
                      {auth.currentWorkspace?.role}
                    </span>
                  </div>
                </section>

                <div class="border-t border-[var(--border)]" />

                {/* Invite Form */}
                <Show when={canInvite()}>
                  <section>
                    <h3 class="text-sm font-medium text-[var(--text)] mb-3">Invite Member</h3>
                    <form onSubmit={handleInvite} class="flex gap-2">
                      <input
                        type="email"
                        value={inviteEmail()}
                        onInput={(e) => setInviteEmail(e.currentTarget.value)}
                        placeholder="email@example.com"
                        class="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                        required
                      />
                      <select
                        value={inviteRole()}
                        onChange={(e) => setInviteRole(e.currentTarget.value as 'editor' | 'guest')}
                        class="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                      >
                        <Show when={isOwner()}>
                          <option value="editor">Editor</option>
                        </Show>
                        <option value="guest">Guest</option>
                      </select>
                      <button
                        type="submit"
                        disabled={isInviting()}
                        class="rounded-full border border-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                      >
                        {isInviting() ? '...' : 'Invite'}
                      </button>
                    </form>
                  </section>

                  <div class="border-t border-[var(--border)]" />
                </Show>

                {/* Pending Invites */}
                <Show when={invites().length > 0}>
                  <section>
                    <h3 class="text-sm font-medium text-[var(--text)] mb-3">Pending Invites</h3>
                    <div class="space-y-2">
                      <For each={invites()}>
                        {(invite) => (
                          <div class="flex items-center justify-between py-2">
                            <div>
                              <div class="text-sm text-[var(--text)]">{invite.email}</div>
                              <div class="text-xs text-[var(--text-tertiary)]">
                                Will join as <span class={`rounded px-1 py-0.5 ${getRoleBadge(invite.role)}`}>{invite.role}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleCancelInvite(invite.id)}
                              class="text-xs text-[var(--text-tertiary)] hover:text-red-400"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </For>
                    </div>
                  </section>

                  <div class="border-t border-[var(--border)]" />
                </Show>

                {/* Members */}
                <section>
                  <h3 class="text-sm font-medium text-[var(--text)] mb-3">
                    Members <span class="text-[var(--text-tertiary)]">({members().length})</span>
                  </h3>
                  <div class="space-y-1">
                    <For each={members()}>
                      {(member) => (
                        <div class="flex items-center justify-between py-2">
                          <div class="flex items-center gap-3">
                            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text)]">
                              {member.user?.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                              <div class="text-sm text-[var(--text)]">{member.user?.name || 'Unknown'}</div>
                              <div class="text-xs text-[var(--text-tertiary)]">{member.user?.email}</div>
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <Show
                              when={isOwner() && member.userId !== auth.user?.id && member.role !== 'owner'}
                              fallback={
                                <span class={`rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadge(member.role)}`}>
                                  {member.role}
                                </span>
                              }
                            >
                              <select
                                value={member.role}
                                onChange={(e) => handleChangeRole(member.id, e.currentTarget.value as WorkspaceRole)}
                                class="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                              >
                                <option value="editor">Editor</option>
                                <option value="guest">Guest</option>
                              </select>
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                class="text-[var(--text-tertiary)] hover:text-red-400"
                              >
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </section>

                {/* Leave Workspace */}
                <Show when={!isOwner()}>
                  <div class="border-t border-[var(--border)]" />

                  <section>
                    <button
                      onClick={handleLeaveWorkspace}
                      class="text-sm text-red-400 hover:underline"
                    >
                      Leave workspace
                    </button>
                  </section>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
    </Show>
  )
}
