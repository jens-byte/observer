import { db, schema } from '../db/client'
import { eq } from 'drizzle-orm'
import type { Settings } from '@observer/shared'

interface NotificationPayload {
  siteName: string
  siteUrl: string
  status: 'down' | 'up'
  errorMessage?: string
  statusCode?: number
  downtime?: number // in seconds
  diagnosis?: string // possible cause of the issue
}

// Format downtime to human readable string
function formatDowntime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

// Send Slack webhook notification
async function sendSlackWebhook(webhookUrl: string, payload: NotificationPayload): Promise<boolean> {
  const isDown = payload.status === 'down'
  const color = isDown ? '#ef4444' : '#22c55e'
  const emoji = isDown ? ':red_circle:' : ':large_green_circle:'

  const title = isDown
    ? `${emoji} ${payload.siteName} is DOWN`
    : `${emoji} ${payload.siteName} is back UP`

  const fields = [
    {
      title: 'URL',
      value: payload.siteUrl,
      short: false,
    },
    {
      title: 'Status',
      value: isDown ? 'DOWN' : 'UP',
      short: true,
    },
  ]

  if (isDown && payload.statusCode) {
    fields.push({
      title: 'Status Code',
      value: String(payload.statusCode),
      short: true,
    })
  }

  if (isDown && payload.errorMessage) {
    fields.push({
      title: 'Error',
      value: payload.errorMessage,
      short: false,
    })
  }

  if (isDown && payload.diagnosis) {
    fields.push({
      title: 'Possible Cause',
      value: payload.diagnosis,
      short: false,
    })
  }

  if (!isDown && payload.downtime) {
    fields.push({
      title: 'Downtime Duration',
      value: formatDowntime(payload.downtime),
      short: true,
    })
  }

  const message = {
    attachments: [
      {
        color,
        title,
        fields,
        footer: 'Observer Monitoring',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      console.error(`[Notifier] Slack webhook failed: ${response.status}`)
      return false
    }

    return true
  } catch (error) {
    console.error('[Notifier] Slack webhook error:', (error as Error).message)
    return false
  }
}

// Send Slack Bot message with screenshot (using new file upload API)
async function sendSlackBotMessage(
  botToken: string,
  channelId: string,
  payload: NotificationPayload,
  screenshotBuffer?: Buffer
): Promise<boolean> {
  const isDown = payload.status === 'down'
  const emoji = isDown ? ':red_circle:' : ':large_green_circle:'

  // Build detailed message
  let text = `${emoji} *${payload.siteName}* is ${isDown ? 'DOWN' : 'UP'}\n\n`
  text += `*URL:* ${payload.siteUrl}\n`
  text += `*Status:* ${isDown ? 'DOWN' : 'UP'}\n`

  if (isDown) {
    if (payload.errorMessage) {
      text += `*Error:* ${payload.errorMessage}\n`
    }
    if (payload.diagnosis) {
      text += `*Possible Cause:* ${payload.diagnosis}\n`
    }
  } else {
    if (payload.downtime) {
      text += `*Downtime Duration:* ${formatDowntime(payload.downtime)}\n`
    }
  }

  try {
    // If we have a screenshot, upload it using the new API flow
    if (screenshotBuffer) {
      const filename = `${payload.siteName.replace(/[^a-zA-Z0-9]/g, '-')}-screenshot.png`

      // Step 1: Get upload URL
      const getUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          filename,
          length: String(screenshotBuffer.length),
        }),
      })

      const getUrlResult = await getUrlResponse.json() as { ok: boolean; upload_url?: string; file_id?: string; error?: string }
      if (!getUrlResult.ok || !getUrlResult.upload_url || !getUrlResult.file_id) {
        console.error('[Notifier] Slack getUploadURL failed:', getUrlResult.error)
        // Fall back to sending text message without screenshot
        return await sendSlackTextMessage(botToken, channelId, text)
      }

      // Step 2: Upload file to the URL
      const uploadResponse = await fetch(getUrlResult.upload_url, {
        method: 'POST',
        body: screenshotBuffer,
      })

      if (!uploadResponse.ok) {
        console.error('[Notifier] Slack file upload failed:', uploadResponse.status)
        return await sendSlackTextMessage(botToken, channelId, text)
      }

      // Step 3: Complete the upload and share to channel
      const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{ id: getUrlResult.file_id, title: filename }],
          channel_id: channelId,
          initial_comment: text,
        }),
      })

      const completeResult = await completeResponse.json() as { ok: boolean; error?: string }
      if (!completeResult.ok) {
        console.error('[Notifier] Slack completeUpload failed:', completeResult.error)
        return await sendSlackTextMessage(botToken, channelId, text)
      }

      return true
    } else {
      return await sendSlackTextMessage(botToken, channelId, text)
    }
  } catch (error) {
    console.error('[Notifier] Slack Bot error:', (error as Error).message)
    return false
  }
}

// Helper to send text-only Slack message
async function sendSlackTextMessage(botToken: string, channelId: string, text: string): Promise<boolean> {
  console.log(`[Notifier] Sending Slack message to channel ${channelId}`)
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      text,
      mrkdwn: true,
    }),
  })

  const result = await response.json() as { ok: boolean; error?: string; channel?: string }
  if (!result.ok) {
    console.error('[Notifier] Slack message failed:', result.error)
    return false
  }
  console.log(`[Notifier] Slack message sent successfully to channel ${result.channel}`)
  return true
}

// Send email notification using SMTP
async function sendEmail(settings: Settings, payload: NotificationPayload): Promise<boolean> {
  if (!settings.emailTo || !settings.emailSmtpHost) {
    return false
  }

  // Note: For a proper implementation, you'd use nodemailer or similar
  // This is a simplified version using a basic SMTP approach
  try {
    // For now, we'll just log the email (in production, use nodemailer)
    console.log(`[Notifier] Would send email to ${settings.emailTo}:`)
    console.log(`  Subject: ${payload.siteName} is ${payload.status.toUpperCase()}`)
    console.log(`  Body: ${payload.errorMessage || 'Site status changed'}`)

    // TODO: Implement actual SMTP sending with nodemailer
    // const transporter = nodemailer.createTransport({
    //   host: settings.emailSmtpHost,
    //   port: settings.emailSmtpPort,
    //   auth: {
    //     user: settings.emailSmtpUser,
    //     pass: settings.emailSmtpPass,
    //   },
    // })
    // await transporter.sendMail({
    //   from: 'Observer <noreply@observer.app>',
    //   to: settings.emailTo,
    //   subject: `${payload.siteName} is ${payload.status.toUpperCase()}`,
    //   html: '...',
    // })

    return true
  } catch (error) {
    console.error('[Notifier] Email error:', (error as Error).message)
    return false
  }
}

// Main notification function
export async function sendNotification(
  workspaceId: number,
  payload: NotificationPayload,
  screenshotBuffer?: Buffer
): Promise<void> {
  const settings = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.workspaceId, workspaceId))
    .get()

  if (!settings) {
    console.log(`[Notifier] No settings found for workspace ${workspaceId}`)
    return
  }

  const results: string[] = []

  // Only send Slack notifications if slackEnabled is true
  if (settings.slackEnabled) {
    // If Slack Bot is configured, always use it (supports screenshots)
    // Only fall back to webhook if bot isn't configured
    if (settings.slackBotToken && settings.slackChannelId) {
      // Use screenshot only if screenshotsEnabled is true
      const screenshot = settings.screenshotsEnabled ? screenshotBuffer : undefined
      const success = await sendSlackBotMessage(
        settings.slackBotToken,
        settings.slackChannelId,
        payload,
        screenshot
      )
      results.push(`Slack Bot: ${success ? 'sent' : 'failed'}`)
    } else if (settings.webhookEnabled && settings.webhookUrl) {
      // Fallback to webhook only if bot isn't configured
      const success = await sendSlackWebhook(settings.webhookUrl, payload)
      results.push(`Webhook: ${success ? 'sent' : 'failed'}`)
    }
  }

  // Send email notification
  if (settings.emailEnabled && settings.emailTo) {
    const success = await sendEmail(settings as unknown as Settings, payload)
    results.push(`Email: ${success ? 'sent' : 'failed'}`)
  }

  if (results.length > 0) {
    console.log(`[Notifier] ${payload.siteName} ${payload.status}: ${results.join(', ')}`)
  }
}

// Test notifications
export async function testWebhook(workspaceId: number): Promise<boolean> {
  const settings = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.workspaceId, workspaceId))
    .get()

  if (!settings?.webhookUrl) {
    throw new Error('Webhook URL not configured')
  }

  return sendSlackWebhook(settings.webhookUrl, {
    siteName: 'Test Site',
    siteUrl: 'https://example.com',
    status: 'down',
    errorMessage: 'This is a test notification',
  })
}

export async function testSlackBot(workspaceId: number): Promise<boolean> {
  const settings = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.workspaceId, workspaceId))
    .get()

  if (!settings?.slackBotToken || !settings?.slackChannelId) {
    throw new Error('Slack Bot token and channel ID are required')
  }

  return sendSlackBotMessage(
    settings.slackBotToken,
    settings.slackChannelId,
    {
      siteName: 'Test Site',
      siteUrl: 'https://example.com',
      status: 'down',
      errorMessage: 'This is a test notification from Observer',
    }
  )
}

export async function testEmail(workspaceId: number): Promise<boolean> {
  const settings = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.workspaceId, workspaceId))
    .get()

  if (!settings?.emailTo) {
    throw new Error('Email recipient not configured')
  }

  return sendEmail(settings as unknown as Settings, {
    siteName: 'Test Site',
    siteUrl: 'https://example.com',
    status: 'down',
    errorMessage: 'This is a test notification',
  })
}
