import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'
import { join, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'

// Use DATABASE_PATH env var if set, otherwise use local data directory
const dbPath = process.env.DATABASE_PATH || join(dirname(import.meta.path), '../../data/observer.db')
const dataDir = dirname(dbPath)
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}
const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrent access
sqlite.exec('PRAGMA journal_mode = WAL')

// Create Drizzle instance
export const db = drizzle(sqlite, { schema })

// Export raw sqlite for complex queries
export { sqlite }

// Export schema for use in other files
export { schema }
