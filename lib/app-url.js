// Absolute URLs for links that leave the app (emails).
//
// These links carry password reset / invite tokens, so the origin must never
// be taken from a spoofable Host header in production. NEXT_PUBLIC_APP_URL is
// the single source of truth there. Local development and LAN testing still
// fall back to the incoming request so a phone on the same Wi-Fi gets a link
// it can open.

// Used when a production deployment forgot to set NEXT_PUBLIC_APP_URL. Being
// wrong here means an email link points at production instead of an attacker's
// host — the safe direction to fail.
const PRODUCTION_FALLBACK = 'https://the-family-sync-by-uccp-se-church.vercel.app'
const SAFE_HOST = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/

function normalise(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

export function appUrl(request) {
  const configured = normalise(process.env.NEXT_PUBLIC_APP_URL || '')
  if (configured) return configured

  if (process.env.NODE_ENV === 'production') return PRODUCTION_FALLBACK

  const headers = request?.headers
  const host = headers?.get?.('x-forwarded-host') || headers?.get?.('host')
  if (host && SAFE_HOST.test(host)) {
    const rawProto = headers.get('x-forwarded-proto') || 'http'
    const proto = rawProto === 'https' ? 'https' : 'http'
    return `${proto}://${host}`
  }

  return 'http://localhost:3000'
}
