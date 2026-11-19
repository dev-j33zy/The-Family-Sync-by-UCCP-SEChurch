import { NextResponse } from 'next/server'
import { appUrl } from '@/lib/app-url'
import { modelsFor } from '@/lib/models'
import { requireAdmin } from '@/lib/api-auth'
import { issueAuthToken } from '@/lib/auth-tokens'
import { sendResetEmail } from '@/lib/account-mail'
import { emailConfigured } from '@/lib/email'
import { cleanEmail, readJson } from '@/lib/validate'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { securityLog, securityContext } from '@/lib/audit'

// Admin-triggered password reset: emails a single-use link instead of handing
// out a temporary password. Sessions stay alive until the link is actually
// used, so a mistaken click does not sign the person out.
export async function POST(request) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const limit = rateLimit(`admin:reset:${clientIp(request)}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const { value: body, error: bodyError } = await readJson(request)
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 })
    const normalizedEmail = cleanEmail(body.email)
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    const { User } = await modelsFor('admin')

    const target = await User.findOne({ email: normalizedEmail }).lean()
    if (!target) {
      return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
    }

    const { token, expiresAt } = await issueAuthToken({
      userId: target._id,
      purpose: 'reset',
      createdBy: user.id,
    })
    const resetUrl = `${appUrl(request)}/reset-password/${token}`
    securityLog('token.issued', securityContext(request, {
      purpose: 'reset',
      actorId: user.id,
      subjectId: String(target._id),
    }))

    if (!emailConfigured()) {
      return NextResponse.json(
        {
          error: 'Email is not configured on this deployment.',
          reset_url: resetUrl,
        },
        { status: 503 }
      )
    }

    try {
      await sendResetEmail({ user: target, to: normalizedEmail, resetUrl, expiresAt })
    } catch (err) {
      console.error('reset email failed:', err.message)
      return NextResponse.json(
        {
          error: `Could not send the reset email: ${err.message}`,
          reset_url: resetUrl,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      message: `Password reset link sent to ${normalizedEmail}.`,
      email_sent: true,
    })
  } catch (err) {
    console.error('reset-password error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
