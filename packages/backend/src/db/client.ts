import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'
import { join, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'

// Ensure data directory exists
const dataDir = join(dirname(import.meta.path), '../../data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const dbPath = join(dataDir, 'observer.db')
const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrent access
sqlite.exec('PRAGMA journal_mode = WAL')

// Create Drizzle instance
export const db = drizzle(sqlite, { schema })

// Export schema for use in other files
export { schema }
