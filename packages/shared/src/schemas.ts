import { z } from 'zod'

// Workspace roles
export const workspaceRoleSchema = z.enum(['owner', 'editor', 'guest'])

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
})

// Workspace schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
})

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: workspaceRoleSchema.exclude(['owner']), // Can't invite as owner
})

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
})

// Site schemas
export const createSiteSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  url: z.string().url('Invalid URL'),
  checkInterval: z.number().int().min(1).max(1440).default(5),
})

export const updateSiteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  checkInterval: z.number().int().min(1).max(1440).optional(),
  isActive: z.boolean().optional(),
  isSla: z.boolean().optional(),
  license: z.string().max(500).nullable().optional(),
})

export const reorderSitesSchema = z.object({
  siteIds: z.array(z.number().int().positive()),
})

// Settings schemas
export const updateSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  emailTo: z.string().email().nullable().optional(),
  emailSmtpHost: z.string().max(200).nullable().optional(),
  emailSmtpPort: z.number().int().min(1).max(65535).optional(),
  emailSmtpUser: z.string().max(200).nullable().optional(),
  emailSmtpPass: z.string().max(200).nullable().optional(),
  slackEnabled: z.boolean().optional(),
  webhookEnabled: z.boolean().optional(),
  webhookUrl: z.string().url().nullable().optional(),
  webhookDelaySeconds: z.number().int().min(0).max(3600).optional(),
  sslWarningDays: z.number().int().min(1).max(90).optional(),
  slackBotToken: z.string().max(200).nullable().optional(),
  slackChannelId: z.string().max(50).nullable().optional(),
  screenshotsEnabled: z.boolean().optional(),
  consecutiveFailuresThreshold: z.number().int().min(1).max(10).optional(),
})

// Bulk import schema
export const bulkImportSitesSchema = z.object({
  sites: z.array(
    z.object({
      name: z.string().min(1).max(200),
      url: z.string().url(),
      checkInterval: z.number().int().min(1).max(1440).default(5),
      isSla: z.boolean().default(false),
      license: z.string().max(500).nullable().optional(),
    })
  ),
})

// User profile schema
export const updateUserSchema = z.object({
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  email: z.string().email('Invalid email address').optional(),
})

// Type exports from schemas
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
export type CreateSiteInput = z.infer<typeof createSiteSchema>
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>
export type ReorderSitesInput = z.infer<typeof reorderSitesSchema>
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
export type BulkImportSitesInput = z.infer<typeof bulkImportSitesSchema>
