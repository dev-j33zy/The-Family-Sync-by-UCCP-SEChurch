import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import {
  createSession,
  setSessionCookie,
  verifyPassword,
  verifyPasswordForUnknownUser,
} from '@/lib/auth'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { securityLog, securityContext } from '@/lib/audit'
import { serializeUser } from '@/lib/serialize'
import { cleanEmail } from '@/lib/validate'

export async function POST(request) {
  try {
    // 10 attempts per 10 minutes per address: enough for typos, not a
    // password-guessing loop. x-real-ip is used instead of the spoofable
    // first x-forwarded-for hop (see lib/rate-limit.js).
    const limit = rateLimit(`login:${clientIp(request)}`, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const body = await request.json().catch(() => ({}))
    const email = cleanEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const { Session, User } = await modelsFor('admin')

    const user = await User.findOne({ email }).lean()
    if (!user) {
      // Spend the same CPU time as a real comparison, then return the exact
      // same error as a wrong password.
      await verifyPasswordForUnknownUser(password)
      securityLog('auth.failure', securityContext(request, { reason: 'unknown-email' }))
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      securityLog('auth.failure', securityContext(request, { reason: 'bad-password', userId: String(user._id) }))
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    await Session.deleteMany({ expires_at: { $lt: new Date() } })
    const token = await createSession(user._id)

    await User.updateOne({ _id: user._id }, { $set: { last_login_at: new Date() } })
    securityLog('auth.success', securityContext(request, { userId: String(user._id) }))

    const response = NextResponse.json({ user: serializeUser(user) })
    return setSessionCookie(response, token, request)
  } catch (err) {
    console.error('login error:', err)
    return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 500 })
  }
}
