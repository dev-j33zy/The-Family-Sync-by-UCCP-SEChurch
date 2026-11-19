import { clientIp } from './rate-limit.js'

// =============================================
// SECURITY EVENT LOG
//
// Structured, single-line records go to stdout so Vercel (or any log drain)
// can retain and alert on them. Nothing sensitive is ever logged: secrets are
// redacted before serialisation. This is a detection layer, not a replacement
// for the access controls in api-auth.js / proxy.js / rate-limit.js.
// =============================================

const SENSITIVE_KEY = /(pass(word)?|token|secret|cookie|authorization|api[_-]?key|connection|uri|hash)/i

function redact(value, depth = 0) {
  if (depth > 4) return '[deep]'
  if (value == null) return value
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redact(item, depth + 1))
  if (typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 300) return value.slice(0, 300) + '…'
    return value
  }

  const out = {}
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(item, depth + 1)
  }
  return out
}

/** Log a security-relevant event. Safe to call from any route. */
export function securityLog(event, details = {}) {
  try {
    const record = { at: new Date().toISOString(), event, ...redact(details) }
    console.log('[security] ' + JSON.stringify(record))
  } catch {
    // Logging must never break a request.
  }
}

/** Attach the request context shared by most auth/abuse events. */
export function securityContext(request, extra = {}) {
  if (!request) return extra
  return {
    ip: clientIp(request),
    method: request.method,
    path: request.nextUrl?.pathname || new URL(request.url).pathname,
    ...extra,
  }
}

export const securityEvents = {
  denied: (request, reason, extra) =>
    securityLog('access.denied', securityContext(request, { reason, ...extra })),
  rateLimited: (request, scope) =>
    securityLog('rate.limited', securityContext(request, { scope })),
  crossOrigin: (request, origin) =>
    securityLog('csrf.rejected', securityContext(request, { origin })),
  adminChanged: (request, action, extra) =>
    securityLog('admin.action', securityContext(request, { action, ...extra })),
  tokenIssued: (request, purpose, extra) =>
    securityLog('token.issued', securityContext(request, { purpose, ...extra })),
  authFailure: (request, reason) =>
    securityLog('auth.failure', securityContext(request, { reason })),
}
