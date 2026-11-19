import { NextResponse, after } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import {
  authUser,
  tokenFromRequest,
  destroyOtherSessions,
  hashPassword,
  verifyPassword,
} from '@/lib/auth'
import { passwordProblem } from '@/lib/password-policy'
import {
  accountName,
  notifyEmailChanged,
  notifyNameChanged,
  notifyPasswordChanged,
} from '@/lib/account-mail'
import { serializeUser } from '@/lib/serialize'
import { rateLimit, tooManyRequests } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(request) {
  const user = await authUser(request)
  return NextResponse.json({ user: serializeUser(user) })
}

/**
 * Update the signed-in account.
 *
 * Changing the sign-in email or the password both require the current
 * password — a stolen session must not be able to take the account over.
 * Every change that lands sends a confirmation email.
 */
export async function PATCH(request) {
  try {
    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { User } = await modelsFor('admin')
    const userId = oid(user.id)

    const current = await User.findById(userId).lean()
    if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const now = new Date()

    const update = {}
    const changes = { email: null, previousName: null, nameChanged: false, password: false }

    // Verify the current password at most once per request, and throttle
    // guesses: a stolen session must not become an offline password oracle.
    let currentPasswordOk = null
    let passwordThrottled = false
    async function checkCurrentPassword() {
      if (currentPasswordOk !== null) return currentPasswordOk
      if (!body.current_password) {
        currentPasswordOk = false
        return false
      }
      const limit = rateLimit(`account-password:${user.id}`, {
        limit: 10,
        windowMs: 15 * 60 * 1000,
      })
      if (!limit.allowed) {
        passwordThrottled = true
        currentPasswordOk = false
        return false
      }
      currentPasswordOk = await verifyPassword(body.current_password, current.password_hash)
      return currentPasswordOk
    }

    // --- email ---
    if (body.email !== undefined) {
      const email = String(body.email || '').trim().toLowerCase()
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
      }

      if (email !== current.email) {
        if (!(await checkCurrentPassword())) {
          if (passwordThrottled) return tooManyRequests(15 * 60)
          return NextResponse.json(
            { error: 'Current password is required to change the sign-in email' },
            { status: 400 }
          )
        }
        const existing = await User.findOne({ email, _id: { $ne: userId } }).lean()
        if (existing) {
          return NextResponse.json({ error: 'That email is already in use by another account' }, { status: 409 })
        }
        update.email = email
        changes.email = { from: current.email, to: email }
      }
    }

    // --- password ---
    if (body.password !== undefined && body.password !== '') {
      const problem = passwordProblem(body.password)
      if (problem) return NextResponse.json({ error: problem }, { status: 400 })

      if (!body.current_password) {
        return NextResponse.json(
          { error: 'Current password is required to change the password' },
          { status: 400 }
        )
      }
      if (!(await checkCurrentPassword())) {
        if (passwordThrottled) return tooManyRequests(15 * 60)
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }

      update.password_hash = await hashPassword(body.password)
      update.password_changed_at = now
      changes.password = true
    }

    // --- name ---
    if (body.display_name !== undefined || body.first_name !== undefined || body.last_name !== undefined) {
      if (body.first_name !== undefined) update.first_name = body.first_name || null
      if (body.last_name !== undefined) update.last_name = body.last_name || null

      if (body.display_name !== undefined) {
        update.display_name = String(body.display_name).slice(0, 100) || null
      } else if (body.first_name !== undefined || body.last_name !== undefined) {
        const first = update.first_name !== undefined ? update.first_name : current.first_name
        const last = update.last_name !== undefined ? update.last_name : current.last_name
        update.display_name = [first, last].filter(Boolean).join(' ').trim() || null
      }

      // Compare every name field: changing only `display_name` still changes
      // how the account is shown.
      const signature = value =>
        [value.first_name, value.last_name, value.display_name].map(v => v || '').join('|')

      const previousName = accountName(current)
      if (signature(current) !== signature({ ...current, ...update })) {
        changes.nameChanged = true
        changes.previousName = previousName
      }
    }

    if (Object.keys(update).length) {
      await User.updateOne({ _id: userId }, { $set: update })
    }

    if (changes.password) {
      const token = tokenFromRequest(request)
      await destroyOtherSessions(userId, token)
    }

    const updated = await User.findById(userId).lean()

    after(async () => {
      if (changes.email) {
        await notifyEmailChanged({
          user: updated,
          oldEmail: changes.email.from,
          newEmail: changes.email.to,
          when: now,
        })
      }
      if (changes.password) {
        await notifyPasswordChanged(updated, now)
      }
      if (changes.nameChanged) {
        await notifyNameChanged(updated, changes.previousName, now)
      }
    })

    return NextResponse.json({ user: serializeUser(updated) })
  } catch (err) {
    console.error('update user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
