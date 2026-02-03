import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
  SiteWithDetails,
  Settings,
  WorkspaceWithRole,
  WorkspaceMember,
  WorkspaceInvite,
} from '@observer/shared'

const API_BASE = '/api'

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || error.message || 'Request failed')
  }

  return response.json()
}

// Auth
export const auth = {
  login: (data: LoginInput) =>
    fetchApi<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  register: (data: RegisterInput) =>
    fetchApi<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => fetchApi<void>('/auth/logout', { method: 'POST' }),

  me: () => fetchApi<AuthResponse>('/auth/me'),

  updateProfile: (data: { firstName?: string | null; lastName?: string | null; email?: string }) =>
    fetchApi<{ user: AuthResponse['user'] }>('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),
}

// Workspaces
export const workspaces = {
  list: () => fetchApi<WorkspaceWithRole[]>('/workspaces'),

  get: (id: number) => fetchApi<WorkspaceWithRole>(`/workspaces/${id}`),

  create: (data: { name: string; slug: string }) =>
    fetchApi<WorkspaceWithRole>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: { name?: string; slug?: string }) =>
    fetchApi<WorkspaceWithRole>(`/workspaces/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: number) => fetchApi<void>(`/workspaces/${id}`, { method: 'DELETE' }),

  members: (id: number) => fetchApi<WorkspaceMember[]>(`/workspaces/${id}/members`),

  invite: (id: number, data: { email: string; role: 'editor' | 'guest' }) =>
    fetchApi<WorkspaceInvite | { added: true; email: string; role: string; message: string }>(`/workspaces/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  invites: (id: number) => fetchApi<WorkspaceInvite[]>(`/workspaces/${id}/invites`),

  cancelInvite: (workspaceId: number, inviteId: number) =>
    fetchApi<void>(`/workspaces/${workspaceId}/invites/${inviteId}`, { method: 'DELETE' }),

  removeMember: (workspaceId: number, memberId: number) =>
    fetchApi<void>(`/workspaces/${workspaceId}/members/${memberId}`, { method: 'DELETE' }),

  updateMemberRole: (workspaceId: number, memberId: number, role: string) =>
    fetchApi<WorkspaceMember>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  acceptInvite: (token: string) =>
    fetchApi<{ workspace: WorkspaceWithRole }>(`/invites/${token}/accept`, { method: 'POST' }),

  getBySlug: (slug: string) =>
    fetchApi<WorkspaceWithRole>(`/workspaces/by-slug/${slug}`),
}

// Sites
export const sites = {
  list: (workspaceId: number) => fetchApi<SiteWithDetails[]>(`/workspaces/${workspaceId}/sites`),

  get: (workspaceId: number, siteId: number) =>
    fetchApi<SiteWithDetails>(`/workspaces/${workspaceId}/sites/${siteId}`),

  create: (workspaceId: number, data: { name: string; url: string; checkInterval?: number }) =>
    fetchApi<SiteWithDetails>(`/workspaces/${workspaceId}/sites`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (workspaceId: number, siteId: number, data: Record<string, unknown>) =>
    fetchApi<SiteWithDetails>(`/workspaces/${workspaceId}/sites/${siteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (workspaceId: number, siteId: number) =>
    fetchApi<void>(`/workspaces/${workspaceId}/sites/${siteId}`, { method: 'DELETE' }),

  check: (workspaceId: number, siteId: number) =>
    fetchApi<{ status: string }>(`/workspaces/${workspaceId}/sites/${siteId}/check`, {
      method: 'POST',
    }),

  toggleStar: (workspaceId: number, siteId: number) =>
    fetchApi<{ isStarred: boolean }>(`/workspaces/${workspaceId}/sites/${siteId}/star`, {
      method: 'POST',
    }),

  simulateDown: (workspaceId: number, siteId: number) =>
    fetchApi<{ status: string }>(`/workspaces/${workspaceId}/sites/${siteId}/simulate-down`, {
      method: 'POST',
    }),

  getChecks: (workspaceId: number, siteId: number, limit = 100) =>
    fetchApi<Array<{
      id: number
      siteId: number
      status: string
      responseTime: number | null
      statusCode: number | null
      errorMessage: string | null
      isSlow: boolean
      checkedAt: string
    }>>(`/workspaces/${workspaceId}/sites/${siteId}/checks?limit=${limit}`),
}

// Settings
export const settings = {
  get: (workspaceId: number) => fetchApi<Settings>(`/workspaces/${workspaceId}/settings`),

  update: (workspaceId: number, data: Partial<Settings>) =>
    fetchApi<Settings>(`/workspaces/${workspaceId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  testEmail: (workspaceId: number) =>
    fetchApi<{ success: boolean }>(`/workspaces/${workspaceId}/settings/test-email`, {
      method: 'POST',
    }),

  testWebhook: (workspaceId: number) =>
    fetchApi<{ success: boolean }>(`/workspaces/${workspaceId}/settings/test-webhook`, {
      method: 'POST',
    }),

  testSlackBot: (workspaceId: number) =>
    fetchApi<{ success: boolean }>(`/workspaces/${workspaceId}/settings/test-slack-bot`, {
      method: 'POST',
    }),
}
