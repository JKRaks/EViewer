const LOCAL_DEVELOPMENT_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/

/**
 * Parse a comma-separated list of exact HTTP(S) origins.
 * Invalid values, URL paths, and wildcards are intentionally ignored.
 */
export function parseAllowedAuthExportOrigins(value = '') {
  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => {
      if (!origin || origin === '*') return false
      try {
        const url = new URL(origin)
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === origin
      } catch {
        return false
      }
    })
}

/**
 * Authentication data may only be exported to an exact, trusted origin.
 * This deliberately does not implement the proxy's wildcard CORS policy.
 */
export function isTrustedAuthExportOrigin(origin, requestOrigin, configuredOrigins = []) {
  if (!origin) return false
  return (
    origin === requestOrigin ||
    LOCAL_DEVELOPMENT_ORIGIN.test(origin) ||
    configuredOrigins.includes(origin)
  )
}
