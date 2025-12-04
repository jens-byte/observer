import { db, schema } from '../db/client'
import { eq } from 'drizzle-orm'
import * as dns from 'dns'

interface DNSInfo {
  nameservers: string | null
  ipAddress: string | null
}

function resolveDNS(hostname: string): Promise<DNSInfo> {
  return new Promise((resolve) => {
    const result: DNSInfo = {
      nameservers: null,
      ipAddress: null,
    }

    // Get IP address (IPv4)
    dns.resolve4(hostname, (err, addresses) => {
      if (!err && addresses?.length) {
        result.ipAddress = addresses.join(', ')
      }

      // Get nameservers
      dns.resolveNs(hostname, (nsErr, nameservers) => {
        if (!nsErr && nameservers?.length) {
          result.nameservers = nameservers.join(', ')
        } else {
          // Try parent domain for nameservers
          const parts = hostname.split('.')
          if (parts.length > 2) {
            const parentDomain = parts.slice(-2).join('.')
            dns.resolveNs(parentDomain, (parentNsErr, parentNameservers) => {
              if (!parentNsErr && parentNameservers?.length) {
                result.nameservers = parentNameservers.join(', ')
              }
              resolve(result)
            })
          } else {
            resolve(result)
          }
        }

        // If we got nameservers, resolve immediately
        if (result.nameservers) {
          resolve(result)
        }
      })
    })

    // Timeout after 5 seconds
    setTimeout(() => resolve(result), 5000)
  })
}

export async function checkDNS(siteId: number, url: string): Promise<DNSInfo | null> {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname

    const dnsInfo = await resolveDNS(hostname)

    // Update or insert DNS info
    const existing = db.select().from(schema.dnsInfo).where(eq(schema.dnsInfo.siteId, siteId)).get()

    if (existing) {
      db.update(schema.dnsInfo)
        .set({
          nameservers: dnsInfo.nameservers,
          ipAddress: dnsInfo.ipAddress,
          lastChecked: new Date().toISOString(),
        })
        .where(eq(schema.dnsInfo.siteId, siteId))
        .run()
    } else {
      db.insert(schema.dnsInfo).values({
        siteId,
        nameservers: dnsInfo.nameservers,
        ipAddress: dnsInfo.ipAddress,
      }).run()
    }

    return dnsInfo
  } catch (error) {
    console.error(`[DNS] Check failed for ${url}:`, (error as Error).message)
    return null
  }
}
