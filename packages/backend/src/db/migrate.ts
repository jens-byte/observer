import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './client'
import { join, dirname } from 'path'

const migrationsFolder = join(dirname(import.meta.path), '../../drizzle')

console.log('Running migrations...')
migrate(db, { migrationsFolder })
console.log('Migrations complete!')
