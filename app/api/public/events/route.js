import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { getEventsPayload } from '@/lib/events'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { securityLog, securityContext } from '@/lib/audit'

// Key-protected endpoint kept for backwards compatibility with older widget
// builds and third-party clients. The current desktop widget uses the
// session-authenticated /api/widget/events instead.
export async function GET(request) {
  try {
    const limit = rateLimit(`public-events:${clientIp(request)}`, {
      limit: 120,
      windowMs: 10 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const expected = process.env.WIDGET_API_KEY
    const key = request.headers.get('x-widget-key')

    // Compare digests, never the raw strings: a string !== check leaks the
    // shared key's prefix through response timing. Hashing both sides first
    // gives fixed-length inputs to timingSafeEqual.
    const suppliedHash = crypto.createHash('sha256').update(String(key || '')).digest()
    const expectedHash = crypto.createHash('sha256').update(String(expected || '')).digest()
    if (!expected || !key || !crypto.timingSafeEqual(suppliedHash, expectedHash)) {
      securityLog('auth.failure', securityContext(request, { reason: 'legacy-widget-key' }))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(await getEventsPayload())
  } catch (err) {
    console.error('public events error:', err)
    return NextResponse.json({ error: 'Unable to load events' }, { status: 500 })
  }
}
