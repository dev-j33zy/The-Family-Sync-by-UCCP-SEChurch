import { NextResponse } from 'next/server'

const SESSION_COOKIE = 'fsync_session'
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Reject state-changing requests whose Origin is not this app.
 *
 * Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE, so a mismatch
 * is a CSRF attempt. Requests with no Origin are non-browser clients (the
 * desktop widget signs in from Node with a Cookie header) and are allowed.
 * SameSite=Lax cookies are the second layer; this check covers older browsers
 * and any future change to the cookie policy.
 */
function originAllowed(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  let expected = null
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) {
    try {
      expected = new URL(configured).origin
    } catch {
      expected = null
    }
  }
  if (!expected) {
    // Local dev: Next's internal origin may be `localhost` while the browser
    // used the machine's LAN IP or 127.0.0.1. The Host header is the address
    // the request was actually made to. Production must set
    // NEXT_PUBLIC_APP_URL; otherwise there is nothing trustworthy to compare.
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '')
    if (host) expected = `${proto}://${host}`
    else expected = request.nextUrl.origin
  }

  try {
    return new URL(origin).origin === expected
  } catch {
    return false
  }
}

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const isLoginPage = pathname.startsWith('/login')
  const isRegisterPage = pathname.startsWith('/register')
  const isPasswordPage =
    pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')
  const isApiRoute = pathname.startsWith('/api')
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon')

  if (STATE_CHANGING.has(request.method) && !originAllowed(request)) {
    console.log(
      '[security] ' +
        JSON.stringify({
          at: new Date().toISOString(),
          event: 'csrf.rejected',
          path: pathname,
          origin: request.headers.get('origin'),
        })
    )
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 })
  }

  // Optimistic check — only checks cookie presence. Real authentication
  // happens in API routes via the session token (lib/auth.js).
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value

  if (!hasSession && !isLoginPage && !isRegisterPage && !isPasswordPage && !isApiRoute && !isPublicAsset) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && (isLoginPage || pathname.startsWith('/forgot-password'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
