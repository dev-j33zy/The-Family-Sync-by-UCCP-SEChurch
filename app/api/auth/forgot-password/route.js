import { NextResponse, after } from 'next/server'
import { appUrl } from '@/lib/app-url'
import { modelsFor } from '@/lib/models'
import { issueAuthToken } from '@/lib/auth-tokens'
import { sendResetEmail } from '@/lib/account-mail'
import { emailConfigured } from '@/lib/email'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Public "forgot password" for administrators.
//
// The response is identical whether or not the address has an account, and the
// email is sent after the response (Next's `after`), so response time does not
// reveal which addresses exist either. Failures are logged, not surfaced.
export async function POST(request) {
  try {
    const ipLimit = rateLimit(`forgot:ip:${clientIp(request)}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfter)

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    // A deployment-wide condition, so this reveals nothing about the address.
    if (!emailConfigured()) {
      return NextResponse.json(
        { error: 'Email is not configured yet. Contact an administrator to reset your password.' },
        { status: 503 }
      )
    }

    const emailLimit = rateLimit(`forgot:email:${email}`, {
      limit: 3,
      windowMs: 15 * 60 * 1000,
    })
    if (!emailLimit.allowed) return tooManyRequests(emailLimit.retryAfter)

    const generic = {
      message: 'If an account exists for that address, a reset link is on its way. Check the inbox and spam folder.',
    }

    const { User } = await modelsFor('admin')
    const user = await User.findOne({ email }).lean()
    if (!user) return NextResponse.json(generic)

    const { token, expiresAt } = await issueAuthToken({
      userId: user._id,
      purpose: 'reset',
      ip: clientIp(request),
    })
    const resetUrl = `${appUrl(request)}/reset-password/${token}`

    after(async () => {
      try {
        await sendResetEmail({ user, to: user.email, resetUrl, expiresAt })
      } catch (err) {
        console.error('forgot-password email failed:', err.message)
      }
    })

    return NextResponse.json(generic)
  } catch (err) {
    console.error('forgot-password error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
