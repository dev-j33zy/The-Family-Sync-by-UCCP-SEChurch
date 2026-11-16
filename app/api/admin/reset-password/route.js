import { NextResponse } from 'next/server'
import { appUrl } from '@/lib/app-url'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'
import { issueAuthToken } from '@/lib/auth-tokens'
import { sendResetEmail } from '@/lib/account-mail'
import { emailConfigured } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Admin-triggered password reset: emails a single-use link instead of handing
// out a temporary password. Sessions stay alive until the link is actually
// used, so a mistaken click does not sign the person out.
export async function POST(request) {
  try {
    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
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
