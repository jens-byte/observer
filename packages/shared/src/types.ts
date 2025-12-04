// Workspace roles
export type WorkspaceRole = 'owner' | 'editor' | 'guest'

// User
export interface User {
  id: number
  email: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

// Session
export interface Session {
  id: string
  userId: number
  expiresAt: string
}

// Workspace
export interface Workspace {
  id: number
  name: string
  slug: string
  createdAt: string
}

// Workspace Member
export interface WorkspaceMember {
  id: number
  workspaceId: number
  userId: number
  role: WorkspaceRole
  invitedBy: number | null
  joinedAt: string
  // Joined user data
  user?: User
}

// Workspace Invite
export interface WorkspaceInvite {
  id: number
  workspaceId: number
  email: string
  role: WorkspaceRole
  token: string
  invitedBy: number
  expiresAt: string
  createdAt: string
  // Joined data
  invitedByUser?: User
  workspace?: Workspace
}

// Site status
export type SiteStatus = 'up' | 'down' | 'unknown'

// Site
export interface Site {
  id: number
  workspaceId: number
  name: string
  url: string
  checkInterval: number
  isActive: boolean
  isStarred: boolean
  isSla: boolean
  license: string | null
  lastStatus: SiteStatus | null
  lastResponseTime: number | null
  lastCheckedAt: string | null
  consecutiveFailures: number
  confirmedDownAt: string | null
  downNotified: boolean
  createdAt: string
}

// Site with additional computed/joined data
export interface SiteWithDetails extends Site {
  isSlow: boolean
  uptime: number | null
  responseHistory: number[]
  sslDaysRemaining: number | null
  sslValidTo: string | null
  nameservers: string | null
  ipAddress: string | null
  cmsName: string | null
  cmsVersion: string | null
}

// Check result
export interface Check {
  id: number
  siteId: number
  status: SiteStatus
  responseTime: number | null
  statusCode: number | null
  errorMessage: string | null
  isSlow: boolean
  checkedAt: string
}

// Settings (per workspace)
export interface Settings {
  id: number
  workspaceId: number
  emailEnabled: boolean
  emailTo: string | null
  emailSmtpHost: string | null
  emailSmtpPort: number
  emailSmtpUser: string | null
  emailSmtpPass: string | null
  slackEnabled: boolean
  webhookEnabled: boolean
  webhookUrl: string | null
  webhookDelaySeconds: number
  sslWarningDays: number
  slackBotToken: string | null
  slackChannelId: string | null
  screenshotsEnabled: boolean
}

// SSL Info
export interface SslInfo {
  id: number
  siteId: number
  issuer: string | null
  validFrom: string | null
  validTo: string | null
  daysRemaining: number | null
  lastChecked: string
}

// DNS Info
export interface DnsInfo {
  id: number
  siteId: number
  nameservers: string | null
  ipAddress: string | null
  lastChecked: string
}

// CMS Info
export interface CmsInfo {
  id: number
  siteId: number
  cmsName: string | null
  cmsVersion: string | null
  lastChecked: string
}

// API Response types
export interface ApiError {
  error: string
  message?: string
}

export interface AuthResponse {
  user: User
  workspaces: WorkspaceWithRole[]
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole
}

// Dashboard stats
export interface DashboardStats {
  total: number
  up: number
  down: number
  slow: number
  sslWarnings: number
}

// SSE Event types
export type SseEventType = 'check' | 'site-update' | 'connected'

export interface SseCheckEvent {
  type: 'check'
  siteId: number
  status: SiteStatus
  responseTime: number | null
  isSlow: boolean
}

export interface SseSiteUpdateEvent {
  type: 'site-update'
  site: SiteWithDetails
}

export interface SseConnectedEvent {
  type: 'connected'
  workspaceId: number
}

export type SseEvent = SseCheckEvent | SseSiteUpdateEvent | SseConnectedEvent
