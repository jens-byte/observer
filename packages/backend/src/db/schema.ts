import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Users table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// Sessions table
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
})

// Workspaces table
export const workspaces = sqliteTable('workspaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// Workspace members table
export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workspaceId: integer('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'editor', 'guest'] }).notNull(),
    invitedBy: integer('invited_by').references(() => users.id),
    joinedAt: text('joined_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [unique().on(table.workspaceId, table.userId)]
)

// Workspace invites table
export const workspaceInvites = sqliteTable('workspace_invites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', { enum: ['owner', 'editor', 'guest'] }).notNull(),
  token: text('token').notNull().unique(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// Sites table
export const sites = sqliteTable('sites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  checkInterval: integer('check_interval').notNull().default(5),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isStarred: integer('is_starred', { mode: 'boolean' }).notNull().default(false),
  isSla: integer('is_sla', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  license: text('license'),
  widgetToken: text('widget_token'),
  // Cached values for fast queries
  lastStatus: text('last_status'),
  lastResponseTime: integer('last_response_time'),
  lastCheckedAt: text('last_checked_at'),
  cachedIsSlow: integer('cached_is_slow', { mode: 'boolean' }).notNull().default(false),
  cachedUptime: text('cached_uptime'),
  // Down tracking
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  confirmedDownAt: text('confirmed_down_at'),
  downNotified: integer('down_notified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// Checks table
export const checks = sqliteTable('checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  siteId: integer('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  responseTime: integer('response_time'),
  statusCode: integer('status_code'),
  errorMessage: text('error_message'),
  isSlow: integer('is_slow', { mode: 'boolean' }).notNull().default(false),
  checkedAt: text('checked_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// Settings table (per workspace)
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id')
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(false),
  emailTo: text('email_to'),
  emailSmtpHost: text('email_smtp_host'),
  emailSmtpPort: integer('email_smtp_port').notNull().default(587),
  emailSmtpUser: text('email_smtp_user'),
  emailSmtpPass: text('email_smtp_pass'),
  slackEnabled: integer('slack_enabled', { mode: 'boolean' }).notNull().default(false),
  webhookEnabled: integer('webhook_enabled', { mode: 'boolean' }).notNull().default(false),
  webhookUrl: text('webhook_url'),
  webhookDelaySeconds: integer('webhook_delay_seconds').notNull().default(0),
  sslWarningDays: integer('ssl_warning_days').notNull().default(14),
  slackBotToken: text('slack_bot_token'),
  slackChannelId: text('slack_channel_id'),
  screenshotsEnabled: integer('screenshots_enabled', { mode: 'boolean' }).notNull().default(true),
})

// SSL info table
export const sslInfo = sqliteTable('ssl_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  siteId: integer('site_id')
    .notNull()
    .unique()
    .references(() => sites.id, { onDelete: 'cascade' }),
  issuer: text('issuer'),
  validFrom: text('valid_from'),
  validTo: text('valid_to'),
  daysRemaining: integer('days_remaining'),
  lastChecked: text('last_checked')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// DNS info table
export const dnsInfo = sqliteTable('dns_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  siteId: integer('site_id')
    .notNull()
    .unique()
    .references(() => sites.id, { onDelete: 'cascade' }),
  nameservers: text('nameservers'),
  ipAddress: text('ip_address'),
  lastChecked: text('last_checked')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// CMS info table
export const cmsInfo = sqliteTable('cms_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  siteId: integer('site_id')
    .notNull()
    .unique()
    .references(() => sites.id, { onDelete: 'cascade' }),
  cmsName: text('cms_name'),
  cmsVersion: text('cms_version'),
  lastChecked: text('last_checked')
    .notNull()
    .default(sql`(datetime('now'))`),
})
