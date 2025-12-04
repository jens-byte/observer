import nodemailer from 'nodemailer'
import { db, schema } from '../db/client'
import { eq } from 'drizzle-orm'

const appUrl = process.env.APP_URL || 'https://observer.megavisor.be'

// Get SMTP settings from workspace
function getSmtpConfig(workspaceId: number) {
  const settings = db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.workspaceId, workspaceId))
    .get()

  if (!settings) return null

  return {
    host: settings.emailSmtpHost,
    port: settings.emailSmtpPort || 587,
    secure: settings.emailSmtpPort === 465,
    auth: {
      user: settings.emailSmtpUser,
      pass: settings.emailSmtpPass,
    },
    from: settings.emailTo || 'Observer <noreply@observer.megavisor.be>',
  }
}

// Send workspace invite email
export async function sendInviteEmail(
  to: string,
  inviteToken: string,
  workspaceName: string,
  inviterName: string,
  workspaceId: number
): Promise<boolean> {
  const smtpConfig = getSmtpConfig(workspaceId)

  if (!smtpConfig || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.log('[Email] SMTP not configured for workspace, skipping invite email')
    return false
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth,
  })

  const inviteUrl = `${appUrl}/invite/${inviteToken}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #0a0a0a; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Observer</h1>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0a0a0a; margin: 0 0 16px; font-size: 20px;">You're invited!</h2>
      <p style="color: #666666; line-height: 1.6; margin: 0 0 24px;">
        <strong>${inviterName}</strong> has invited you to join the workspace <strong>${workspaceName}</strong> on Observer.
      </p>
      <a href="${inviteUrl}" style="display: inline-block; background: #0a0a0a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 500;">
        Accept Invitation
      </a>
      <p style="color: #999999; font-size: 14px; margin: 24px 0 0; line-height: 1.5;">
        Or copy this link:<br>
        <a href="${inviteUrl}" style="color: #10a37f; word-break: break-all;">${inviteUrl}</a>
      </p>
      <p style="color: #999999; font-size: 12px; margin: 24px 0 0;">
        This invitation expires in 7 days.
      </p>
    </div>
  </div>
</body>
</html>
`

  const text = `
You're invited to Observer!

${inviterName} has invited you to join the workspace "${workspaceName}" on Observer.

Accept the invitation: ${inviteUrl}

This invitation expires in 7 days.
`

  try {
    await transporter.sendMail({
      from: smtpConfig.from,
      to,
      subject: `You're invited to join ${workspaceName} on Observer`,
      text,
      html,
    })
    console.log(`[Email] Invite sent to ${to}`)
    return true
  } catch (error) {
    console.error('[Email] Failed to send invite:', (error as Error).message)
    return false
  }
}

// Verify SMTP connection for a workspace
export async function verifyEmailConfig(workspaceId: number): Promise<boolean> {
  const smtpConfig = getSmtpConfig(workspaceId)

  if (!smtpConfig || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.log('[Email] SMTP not configured')
    return false
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth,
  })

  try {
    await transporter.verify()
    console.log('[Email] SMTP connection verified')
    return true
  } catch (error) {
    console.error('[Email] SMTP verification failed:', (error as Error).message)
    return false
  }
}
