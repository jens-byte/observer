import { chromium, type Browser, type BrowserContext } from 'playwright'

let browser: Browser | null = null
let browserUseCount = 0
const MAX_BROWSER_USES = 5

// Simple mutex for browser operations
let browserLock: Promise<void> = Promise.resolve()

async function withBrowserLock<T>(fn: () => Promise<T>): Promise<T> {
  const previousLock = browserLock
  let releaseLock: () => void
  browserLock = new Promise((resolve) => {
    releaseLock = resolve
  })

  try {
    await previousLock
    return await fn()
  } finally {
    releaseLock!()
  }
}

// Force restart browser (when it crashes or becomes unresponsive)
async function restartBrowser(): Promise<Browser> {
  if (browser) {
    try {
      await browser.close()
    } catch (e) {
      // Ignore close errors
    }
    browser = null
  }

  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
    ],
  })

  browserUseCount = 1
  return browser
}

// Get or create browser instance (restart after MAX_BROWSER_USES to prevent memory leaks)
async function getBrowser(): Promise<Browser> {
  // Check if existing browser is still alive
  if (browser && browser.isConnected() && browserUseCount < MAX_BROWSER_USES) {
    browserUseCount++
    return browser
  }

  // Browser is dead or needs restart
  return restartBrowser()
}

// Generate error page HTML
function getErrorPageHtml(url: string, errorType: string): string {
  const errorMessages: Record<string, { title: string; description: string }> = {
    dns: {
      title: "This site can't be reached",
      description: "DNS lookup failed - the domain name could not be resolved.",
    },
    timeout: {
      title: "This site can't be reached",
      description: "The connection timed out - the server took too long to respond.",
    },
    refused: {
      title: "This site can't be reached",
      description: "Connection refused - the server is not accepting connections.",
    },
    default: {
      title: "This site can't be reached",
      description: "The site is unreachable or not responding.",
    },
  }

  const error = errorMessages[errorType] || errorMessages.default

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: #f5f5f5;
          margin: 0;
          padding: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 120px);
          color: #333;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 24px;
          font-weight: 500;
          margin: 0 0 16px 0;
        }
        p {
          font-size: 16px;
          color: #666;
          margin: 0 0 24px 0;
          text-align: center;
          max-width: 500px;
        }
        .url {
          font-size: 14px;
          color: #999;
          word-break: break-all;
          max-width: 600px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="icon">🚫</div>
      <h1>${error.title}</h1>
      <p>${error.description}</p>
      <div class="url">${url}</div>
    </body>
    </html>
  `
}

// Internal function to take screenshot (called by captureScreenshot with retry logic)
async function takeScreenshot(url: string): Promise<Buffer> {
  const browserInstance = await getBrowser()

  const context = await browserInstance.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })

  try {
    const page = await context.newPage()
    let navigationFailed = false
    let errorType = 'default'

    // Try to navigate - if it fails, we'll render a custom error page
    try {
      await page.goto(url, {
        waitUntil: 'commit', // Faster - returns after response headers received
        timeout: 15000,
      })
      // Wait a bit for page content to render
      await page.waitForTimeout(1000)
    } catch (navigationError) {
      navigationFailed = true
      const errorMsg = (navigationError as Error).message.toLowerCase()

      // Determine error type for custom error page
      if (errorMsg.includes('enotfound') || errorMsg.includes('getaddrinfo') || errorMsg.includes('dns')) {
        errorType = 'dns'
      } else if (errorMsg.includes('timeout') || errorMsg.includes('etimedout')) {
        errorType = 'timeout'
      } else if (errorMsg.includes('econnrefused') || errorMsg.includes('refused')) {
        errorType = 'refused'
      }

      console.log(`[Screenshot] Navigation failed for ${url} (${errorType}), rendering error page`)
    }

    // Check if page is blank (headless Chromium issue with error pages)
    // If navigation failed or page appears blank, render custom error page
    if (navigationFailed) {
      const bodyContent = await page.evaluate(() => document.body?.innerText?.trim() || '')

      if (!bodyContent || bodyContent.length < 10) {
        // Page is blank - render custom error page
        await page.setContent(getErrorPageHtml(url, errorType))
        await page.waitForTimeout(100)
      }
    }

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    })

    return Buffer.from(screenshot)
  } finally {
    await context.close()
  }
}

// Timeout wrapper to prevent Playwright from hanging indefinitely
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: Timer
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId!)
  }
}

// Capture a screenshot of a URL (including browser error pages when site is down)
export async function captureScreenshot(url: string): Promise<Buffer | null> {
  // Overall timeout of 30 seconds for the entire screenshot operation
  const SCREENSHOT_TIMEOUT = 30000

  try {
    return await withTimeout(
      withBrowserLock(async () => {
        try {
          return await takeScreenshot(url)
        } catch (error) {
          const errorMessage = (error as Error).message

          // If browser crashed/closed, restart and retry once
          if (errorMessage.includes('closed') || errorMessage.includes('crashed') || errorMessage.includes('Target')) {
            console.log(`[Screenshot] Browser crashed for ${url}, restarting and retrying...`)
            try {
              await restartBrowser()
              return await takeScreenshot(url)
            } catch (retryError) {
              console.error(`[Screenshot] Retry failed for ${url}:`, (retryError as Error).message)
              return null
            }
          }

          console.error(`[Screenshot] Capture failed for ${url}:`, errorMessage)
          return null
        }
      }),
      SCREENSHOT_TIMEOUT,
      `Screenshot timeout after ${SCREENSHOT_TIMEOUT}ms`
    )
  } catch (error) {
    console.error(`[Screenshot] Timeout for ${url}:`, (error as Error).message)
    // Force restart browser on timeout to recover from hung state
    try {
      await restartBrowser()
    } catch {
      // Ignore restart errors
    }
    return null
  }
}

// Diagnose the problem based on error message and status code
export function diagnoseProblem(errorMessage: string | null, statusCode: number | null): string {
  // Check for specific error patterns
  if (errorMessage) {
    const error = errorMessage.toLowerCase()

    if (error.includes('econnrefused') || error.includes('connection refused')) {
      return 'Connection refused - The server is not accepting connections. Check if the web server (nginx/apache) is running.'
    }

    if (error.includes('enotfound') || error.includes('getaddrinfo')) {
      return 'DNS lookup failed - The domain name could not be resolved. Check DNS settings or if the domain has expired.'
    }

    if (error.includes('etimedout') || error.includes('timeout') || error.includes('timed out')) {
      return 'Connection timeout - The server took too long to respond. Possible network issues or server overload.'
    }

    if (error.includes('econnreset') || error.includes('connection reset')) {
      return 'Connection reset - The server closed the connection unexpectedly. Check server logs for crashes.'
    }

    if (error.includes('cert') || error.includes('ssl') || error.includes('tls')) {
      return 'SSL/TLS error - Certificate issue detected. Check if the SSL certificate is valid and not expired.'
    }

    if (error.includes('socket hang up')) {
      return 'Socket hang up - The connection was dropped. Server may have crashed or is overloaded.'
    }

    if (error.includes('simulated')) {
      return 'This is a simulated downtime for testing purposes.'
    }
  }

  // Check status codes
  if (statusCode) {
    if (statusCode === 500) {
      return 'Internal Server Error (500) - The server encountered an error. Check application logs for exceptions.'
    }

    if (statusCode === 502) {
      return 'Bad Gateway (502) - The upstream server returned an invalid response. Check if the application server is running.'
    }

    if (statusCode === 503) {
      return 'Service Unavailable (503) - The server is temporarily overloaded or under maintenance.'
    }

    if (statusCode === 504) {
      return 'Gateway Timeout (504) - The upstream server took too long to respond. Check application performance.'
    }

    if (statusCode === 520 || statusCode === 521 || statusCode === 522 || statusCode === 523 || statusCode === 524) {
      return `Cloudflare Error (${statusCode}) - Issue between Cloudflare and the origin server. Check origin server status.`
    }

    if (statusCode === 403) {
      return 'Forbidden (403) - Access denied. Check firewall rules or .htaccess configuration.'
    }

    if (statusCode === 404) {
      return 'Not Found (404) - The page was not found. Check if the URL path is correct.'
    }

    if (statusCode >= 400 && statusCode < 500) {
      return `Client Error (${statusCode}) - The request was invalid. Check URL and server configuration.`
    }

    if (statusCode >= 500) {
      return `Server Error (${statusCode}) - The server failed to process the request. Check server logs.`
    }
  }

  return 'Unknown issue - Check server logs, verify the URL is correct, and ensure the server is running properly.'
}

// Cleanup browser on process exit
process.on('beforeExit', async () => {
  if (browser) {
    try {
      await browser.close()
    } catch (e) {
      // Ignore
    }
  }
})
