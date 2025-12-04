import { Hono } from 'hono'
import { db, schema } from '../db/client'
import { eq } from 'drizzle-orm'
import { updateSettingsSchema } from '@observer/shared'
import type { Settings } from '@observer/shared'
import { requireWorkspace, type WorkspaceContext } from '../middleware/auth'
import { testWebhook, testEmail } from '../services/notifier'

const settings = new Hono<WorkspaceContext>()

// Get settings for workspace
settings.get('/', requireWorkspace('editor'), (c: any) => {
  const workspaceId = c.get('workspaceId')

  const result = db.select().from(schema.settings).where(eq(schema.settings.workspaceId, workspaceId)).get()

  if (!result) {
    // Create default settings if not exist
    const newSettings = db
      .insert(schema.settings)
      .values({ workspaceId })
      .returning()
      .get()
    return c.json(formatSettings(newSettings))
  }

  return c.json(formatSettings(result))
})

// Update settings
settings.put('/', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')
  const body = await c.req.json()

  const result = updateSettingsSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: result.error.errors[0]?.message || 'Invalid input' }, 400)
  }

  // Ensure settings exist
  let existing = db.select().from(schema.settings).where(eq(schema.settings.workspaceId, workspaceId)).get()

  if (!existing) {
    existing = db.insert(schema.settings).values({ workspaceId }).returning().get()
  }

  const updates: Record<string, any> = {}
  const data = result.data

  if (data.emailEnabled !== undefined) updates.emailEnabled = data.emailEnabled
  if (data.emailTo !== undefined) updates.emailTo = data.emailTo
  if (data.emailSmtpHost !== undefined) updates.emailSmtpHost = data.emailSmtpHost
  if (data.emailSmtpPort !== undefined) updates.emailSmtpPort = data.emailSmtpPort
  if (data.emailSmtpUser !== undefined) updates.emailSmtpUser = data.emailSmtpUser
  if (data.emailSmtpPass !== undefined) updates.emailSmtpPass = data.emailSmtpPass
  if (data.webhookEnabled !== undefined) updates.webhookEnabled = data.webhookEnabled
  if (data.webhookUrl !== undefined) updates.webhookUrl = data.webhookUrl
  if (data.webhookDelaySeconds !== undefined) updates.webhookDelaySeconds = data.webhookDelaySeconds
  if (data.sslWarningDays !== undefined) updates.sslWarningDays = data.sslWarningDays
  if (data.slackBotToken !== undefined) updates.slackBotToken = data.slackBotToken
  if (data.slackChannelId !== undefined) updates.slackChannelId = data.slackChannelId

  if (Object.keys(updates).length > 0) {
    db.update(schema.settings).set(updates).where(eq(schema.settings.workspaceId, workspaceId)).run()
  }

  const updated = db.select().from(schema.settings).where(eq(schema.settings.workspaceId, workspaceId)).get()

  return c.json(formatSettings(updated!))
})

// Test email
settings.post('/test-email', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')

  try {
    const success = await testEmail(workspaceId)
    return c.json({ success })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400)
  }
})

// Test webhook
settings.post('/test-webhook', requireWorkspace('editor'), async (c: any) => {
  const workspaceId = c.get('workspaceId')

  try {
    const success = await testWebhook(workspaceId)
    return c.json({ success })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400)
  }
})

// Helper to format settings for API response
function formatSettings(s: typeof schema.settings.$inferSelect): Settings {
  return {
    id: s.id,
    workspaceId: s.workspaceId,
    emailEnabled: s.emailEnabled,
    emailTo: s.emailTo,
    emailSmtpHost: s.emailSmtpHost,
    emailSmtpPort: s.emailSmtpPort,
    emailSmtpUser: s.emailSmtpUser,
    emailSmtpPass: s.emailSmtpPass,
    webhookEnabled: s.webhookEnabled,
    webhookUrl: s.webhookUrl,
    webhookDelaySeconds: s.webhookDelaySeconds,
    sslWarningDays: s.sslWarningDays,
    slackBotToken: s.slackBotToken,
    slackChannelId: s.slackChannelId,
  }
}

export default settings
