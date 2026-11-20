import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { appUrl } from '@/lib/app-url'
import { modelsFor } from '@/lib/models'
import { hashPassword } from '@/lib/auth'
import { requireAdmin } from '@/lib/api-auth'
import { issueAuthToken } from '@/lib/auth-tokens'
import { sendInviteEmail } from '@/lib/account-mail'
import { emailConfigured } from '@/lib/email'
import { serializeUser } from '@/lib/serialize'
import { cleanEmail, readJson } from '@/lib/validate'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { securityLog, securityContext } from '@/lib/audit'

export async function POST(request) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    // Account creation sends an invite and mints a token: keep it a deliberate,
    // bounded action even for a signed-in administrator.
    const limit = rateLimit(`admin:create-user:${clientIp(request)}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const { value: body, error: bodyError } = await readJson(request)
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 })

    // Invites are sent by email address only. The invited admin provides their
    // name when they open the link and set a password.
    const normalizedEmail = cleanEmail(body.email)

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    const { User } = await modelsFor('admin')

    const existing = await User.findOne({ email: normalizedEmail }).lean()
    if (existing) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }

    // The account starts with a password nobody knows. The only way in is the
    // invite link, which proves the person can read that inbox.
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'))

    let created
    try {
      created = await User.create({
        email: normalizedEmail,
        password_hash: passwordHash,
        role: 'Administrator',
        first_name: null,
        last_name: null,
        display_name: null,
        invited_at: new Date(),
      })
    } catch (err) {
      if (err?.code === 11000) {
        return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
      }
      throw err
    }

    const { token, expiresAt } = await issueAuthToken({
      userId: created._id,
      purpose: 'invite',
      createdBy: user.id,
    })
    const inviteUrl = `${appUrl(request)}/reset-password/${token}`
    securityLog('token.issued', securityContext(request, {
      purpose: 'invite',
      actorId: user.id,
      subjectId: String(created._id),
    }))

    let emailSent = false
    let emailError = null

    if (emailConfigured()) {
      try {
        await sendInviteEmail({ user: created, to: normalizedEmail, inviteUrl, expiresAt })
        emailSent = true
      } catch (err) {
        emailError = err.message
        console.error('invite email failed:', err.message)
      }
    } else {
      emailError = 'Email is not configured on this deployment.'
    }

    securityLog('admin.action', securityContext(request, {
      action: 'user.create',
      actorId: user.id,
      subjectId: String(created._id),
    }))

    return NextResponse.json(
      {
        message: emailSent
          ? `Invitation sent to ${normalizedEmail}.`
          : 'User created, but the invitation email could not be sent.',
        user: serializeUser(created),
        email_sent: emailSent,
        email_error: emailError,
        // Only returned when the email did not go out, so the admin can pass
        // the link along by hand instead of the account being unreachable.
        invite_url: emailSent ? undefined : inviteUrl,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('create-user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
