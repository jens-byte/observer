import { hash, verify } from '@node-rs/argon2'

// Password hashing with Argon2
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await verify(hash, password)
  } catch {
    return false
  }
}

// Generate secure random tokens
export function generateToken(length = 32): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Generate URL-friendly slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

// Session expiration (30 days)
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export function getSessionExpiry(): string {
  return new Date(Date.now() + SESSION_DURATION_MS).toISOString()
}

// Invite expiration (7 days)
export const INVITE_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export function getInviteExpiry(): string {
  return new Date(Date.now() + INVITE_DURATION_MS).toISOString()
}
