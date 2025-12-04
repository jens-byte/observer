import { db, schema } from '../db/client'
import { eq } from 'drizzle-orm'
import * as tls from 'tls'
import * as dns from 'dns'

interface SSLInfo {
  issuer: string | null
  validFrom: string | null
  validTo: string | null
  daysRemaining: number | null
}

function getSSLCertificate(hostname: string, port = 443): Promise<SSLInfo> {
  return new Promise((resolve, reject) => {
    // First resolve DNS to get IPv4 address
    dns.resolve4(hostname, (dnsErr, addresses) => {
      if (dnsErr || !addresses?.length) {
        reject(new Error(`DNS resolution failed: ${dnsErr?.message || 'No addresses found'}`))
        return
      }

      const ipAddress = addresses[0]

      const socket = tls.connect(
        {
          host: ipAddress,
          port,
          servername: hostname, // SNI
          rejectUnauthorized: false, // Accept self-signed certs
          timeout: 10000,
        },
        () => {
          try {
            const cert = socket.getPeerCertificate()

            if (!cert || !cert.valid_to) {
              socket.destroy()
              reject(new Error('No certificate found'))
              return
            }

            const validTo = new Date(cert.valid_to)
            const validFrom = new Date(cert.valid_from)
            const now = new Date()
            const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

            // Extract issuer
            let issuer: string | null = null
            if (cert.issuer) {
              issuer = cert.issuer.O || cert.issuer.CN || JSON.stringify(cert.issuer)
            }

            socket.destroy()

            resolve({
              issuer,
              validFrom: validFrom.toISOString(),
              validTo: validTo.toISOString(),
              daysRemaining,
            })
          } catch (error) {
            socket.destroy()
            reject(error)
          }
        }
      )

      socket.on('error', (err) => {
        socket.destroy()
        reject(err)
      })

      socket.on('timeout', () => {
        socket.destroy()
        reject(new Error('SSL connection timeout'))
      })
    })
  })
}

export async function checkSSL(siteId: number, url: string): Promise<SSLInfo | null> {
  try {
    const urlObj = new URL(url)

    if (urlObj.protocol !== 'https:') {
      return null
    }

    const hostname = urlObj.hostname
    const port = urlObj.port ? parseInt(urlObj.port, 10) : 443

    const sslInfo = await getSSLCertificate(hostname, port)

    // Update or insert SSL info
    const existing = db.select().from(schema.sslInfo).where(eq(schema.sslInfo.siteId, siteId)).get()

    if (existing) {
      db.update(schema.sslInfo)
        .set({
          issuer: sslInfo.issuer,
          validFrom: sslInfo.validFrom,
          validTo: sslInfo.validTo,
          daysRemaining: sslInfo.daysRemaining,
          lastChecked: new Date().toISOString(),
        })
        .where(eq(schema.sslInfo.siteId, siteId))
        .run()
    } else {
      db.insert(schema.sslInfo).values({
        siteId,
        issuer: sslInfo.issuer,
        validFrom: sslInfo.validFrom,
        validTo: sslInfo.validTo,
        daysRemaining: sslInfo.daysRemaining,
      }).run()
    }

    // Check for SSL warning
    const settings = db
      .select()
      .from(schema.sites)
      .innerJoin(schema.settings, eq(schema.sites.workspaceId, schema.settings.workspaceId))
      .where(eq(schema.sites.id, siteId))
      .get()

    if (settings && sslInfo.daysRemaining !== null) {
      const warningDays = settings.settings.sslWarningDays || 14
      if (sslInfo.daysRemaining <= warningDays) {
        console.log(
          `[SSL] Warning: ${url} certificate expires in ${sslInfo.daysRemaining} days`
        )
        // TODO: Send SSL warning notification
      }
    }

    return sslInfo
  } catch (error) {
    console.error(`[SSL] Check failed for ${url}:`, (error as Error).message)
    return null
  }
}
