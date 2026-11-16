import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { appUrl } from '@/lib/app-url'
import { modelsFor } from '@/lib/models'
import { authUser, hashPassword } from '@/lib/auth'
import { issueAuthToken } from '@/lib/auth-tokens'
import { sendInviteEmail } from '@/lib/account-mail'
import { emailConfigured } from '@/lib/email'
import { serializeUser } from '@/lib/serialize'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request) {
  try {
    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { first_name, last_name, email } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!first_name || !last_name || !normalizedEmail) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 })
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    const { User } = await modelsFor('admin')

    const existing = await User.findOne({ email: normalizedEmail }).lean()
    if (existing) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }

    // The account starts with a password nobody knows. The only way in is the
    // invite link, which proves the person can read that inbox.
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'))
    const displayName = [first_name, last_name].filter(Boolean).join(' ').trim()

    let created
    try {
      created = await User.create({
        email: normalizedEmail,
        password_hash: passwordHash,
        role: 'Administrator',
        first_name: String(first_name).trim(),
        last_name: String(last_name).trim(),
        display_name: displayName,
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
