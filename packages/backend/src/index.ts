import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

// Initialize database on startup
import './db/client'

// Services
import { startScheduler } from './services/monitor'

// Routes
import authRoutes from './routes/auth'
import workspaceRoutes, { inviteRoutes } from './routes/workspaces'
import siteRoutes from './routes/sites'
import settingsRoutes from './routes/settings'
import sseRoutes from './routes/sse'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://observer.megavisor.be'],
    credentials: true,
  })
)

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// API routes
app.route('/api/auth', authRoutes)
app.route('/api/workspaces', workspaceRoutes)
app.route('/api/invites', inviteRoutes)

// Workspace-scoped routes
app.route('/api/workspaces/:workspaceId/sites', siteRoutes)
app.route('/api/workspaces/:workspaceId/settings', settingsRoutes)

// SSE endpoint
app.route('/api/sse', sseRoutes)

// Serve static files in production
const publicDir = './public'

// Serve assets
app.get('/assets/:filename', async (c) => {
  const filename = c.req.param('filename')
  const file = Bun.file(`${publicDir}/assets/${filename}`)
  if (await file.exists()) {
    const contentType = filename.endsWith('.js')
      ? 'application/javascript'
      : filename.endsWith('.css')
        ? 'text/css'
        : 'application/octet-stream'
    return new Response(file, { headers: { 'Content-Type': contentType } })
  }
  return c.notFound()
})

// Serve favicon
app.get('/favicon.svg', async (c) => {
  const file = Bun.file(`${publicDir}/favicon.svg`)
  if (await file.exists()) {
    return new Response(file, { headers: { 'Content-Type': 'image/svg+xml' } })
  }
  return c.notFound()
})

// SPA fallback - serve index.html for all unmatched routes
app.notFound(async (c) => {
  // If it's an API route, return JSON 404
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404)
  }
  // Otherwise serve index.html for SPA routing
  const file = Bun.file(`${publicDir}/index.html`)
  if (await file.exists()) {
    return new Response(file, { headers: { 'Content-Type': 'text/html' } })
  }
  return c.json({ error: 'Not Found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

const port = Number(process.env.PORT) || 3001

console.log(`🚀 Observer backend starting on port ${port}`)

// Start monitoring scheduler (check every 60 seconds)
startScheduler(60000)

// Start the server
Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`✅ Server running at http://localhost:${port}`)
