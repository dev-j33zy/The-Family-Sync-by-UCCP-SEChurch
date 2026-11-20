import { NextResponse, after } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import {
  createSession,
  destroyUserSessions,
  hashPassword,
  setSessionCookie,
} from '@/lib/auth'
import { peekAuthToken, consumeAuthToken } from '@/lib/auth-tokens'
import { notifyPasswordChanged } from '@/lib/account-mail'
import { passwordProblem } from '@/lib/password-policy'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { serializeUser } from '@/lib/serialize'
import { cleanText } from '@/lib/validate'

function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@')
  if (!domain) return '•••'
  const visible = local.slice(0, local.length > 2 ? 2 : 1)
  return `${visible}${'•'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

/** Does this link still work? Used by the page before showing the form. */
export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('token')
    const found = await peekAuthToken(token)
    if (!found) return NextResponse.json({ valid: false }, { status: 404 })

    const { User } = await modelsFor('admin')
    const user = await User.findById(oid(found.userId)).lean()
    if (!user) return NextResponse.json({ valid: false }, { status: 404 })

    return NextResponse.json({
      valid: true,
      purpose: found.purpose,
      expires_at: found.expiresAt,
      email: maskEmail(user.email),
      name: user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
    })
  } catch (err) {
    console.error('reset-password lookup error:', err)
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}

/**
 * Spend an invite/reset link: set the new password, verify the address (for
 * invites), sign the person in, and confirm by email.
 */
export async function POST(request) {
  try {
    const limit = rateLimit(`reset:ip:${clientIp(request)}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const body = await request.json().catch(() => ({}))
    const token = body.token
    const password = String(body.password || '')
    const firstName = cleanText(body.first_name, 100)
    const lastName = cleanText(body.last_name, 100)

    if (!token) {
      return NextResponse.json({ error: 'This link is incomplete. Request a new one.' }, { status: 400 })
    }

    // Burning the token happens only after the input is valid, so a short
    // password or missing invite name does not waste the link.
    const peek = await peekAuthToken(token)
    if (!peek) {
      return NextResponse.json(
        { error: 'This link is invalid, already used, or expired. Request a new one.' },
        { status: 400 }
      )
    }

    if (peek.purpose === 'invite' && (!firstName || !lastName)) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 })
    }

    const problem = passwordProblem(password)
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 })
    }

    const found = await consumeAuthToken(token)
    if (!found) {
      return NextResponse.json(
        { error: 'This link is invalid, already used, or expired. Request a new one.' },
        { status: 400 }
      )
    }

    const { User } = await modelsFor('admin')
    const user = await User.findById(oid(found.userId)).lean()
    if (!user) {
      return NextResponse.json(
        { error: 'This account no longer exists. Contact an administrator.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const passwordHash = await hashPassword(password)

    const update = {
      password_hash: passwordHash,
      password_changed_at: now,
    }
    if (!user.email_verified_at) update.email_verified_at = now
    if (found.purpose === 'invite') {
      update.first_name = firstName
      update.last_name = lastName
      update.display_name = [firstName, lastName].filter(Boolean).join(' ').trim() || null
    }

    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $set: update },
      { new: true }
    ).lean()

    if (!updated) {
      return NextResponse.json(
        { error: 'This account no longer exists. Contact an administrator.' },
        { status: 400 }
      )
    }

    // Whoever knew the old password is signed out everywhere.
    await destroyUserSessions(user._id)

    after(async () => {
      await notifyPasswordChanged(updated, now)
    })

    const sessionToken = await createSession(user._id)
    const response = NextResponse.json({
      user: serializeUser(updated),
      purpose: found.purpose,
      message:
        found.purpose === 'invite'
          ? 'Your account is ready and your email address is verified.'
          : 'Your password has been updated.',
    })
    return setSessionCookie(response, sessionToken, request)
  } catch (err) {
    console.error('reset-password error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
