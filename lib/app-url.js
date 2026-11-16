// Absolute URLs for links that leave the app (emails).
//
// `NEXT_PUBLIC_APP_URL` wins when it is set — production must set it, because
// Vercel terminates TLS before the request reaches us. Otherwise the incoming
// request is used, so local dev and LAN testing on a phone still produce a
// link the recipient can open.

export function appUrl(request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/+$/, '')

  const headers = request?.headers
  const host = headers?.get?.('x-forwarded-host') || headers?.get?.('host')
  if (host) {
    const proto = headers.get('x-forwarded-proto') || 'http'
    return `${proto}://${host}`
  }

  return 'http://localhost:3000'
}
