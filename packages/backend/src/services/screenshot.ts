// Screenshot functionality has been disabled to avoid Playwright/Chromium dependency
// Only the diagnoseProblem function remains for error analysis

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

