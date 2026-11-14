import { NextResponse } from 'next/server'

const SESSION_COOKIE = 'fsync_session'

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const isLoginPage = pathname.startsWith('/login')
  const isRegisterPage = pathname.startsWith('/register')
  const isApiRoute = pathname.startsWith('/api')
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon')

  // Optimistic check — only checks cookie presence. Real authentication
  // happens in API routes via the session token (lib/auth.js).
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value

  if (!hasSession && !isLoginPage && !isRegisterPage && !isApiRoute && !isPublicAsset) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && isLoginPage) {
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