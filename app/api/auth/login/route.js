import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import { createSession, setSessionCookie, verifyPassword } from '@/lib/auth'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { serializeUser } from '@/lib/serialize'

export async function POST(request) {
  try {
    // 10 attempts per 10 minutes per address: enough for typos, not a
    // password-guessing loop.
    const limit = rateLimit(`login:${clientIp(request)}`, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const { Session, User } = await modelsFor('admin')

    const user = await User.findOne({ email: email.trim().toLowerCase() }).lean()
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    await Session.deleteMany({ expires_at: { $lt: new Date() } })
    const token = await createSession(user._id)

    const response = NextResponse.json({ user: serializeUser(user) })
    return setSessionCookie(response, token, request)
  } catch (err) {
    console.error('login error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
