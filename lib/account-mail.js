import { sendEmail } from './email'
import {
  inviteEmail,
  resetEmail,
  passwordChangedEmail,
  nameChangedEmail,
  emailChangedEmail,
  testEmail,
} from './email-templates'

// Account mail helpers: one place that decides who a message goes to and what
// the person is called.
//
// Invite and reset mail throws on failure — the caller reports it, because a
// link the recipient never receives is a support problem the admin must see.
// Notifications are best-effort: a profile change must not fail because Gmail
// is briefly unavailable.

export function accountName(user) {
  if (!user) return null
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return full || user.display_name || null
}

async function bestEffort(label, fn) {
  try {
    await fn()
    return true
  } catch (err) {
    console.error(`email (${label}) failed:`, err.message)
    return false
  }
}

export async function sendInviteEmail({ user, to, inviteUrl, expiresAt }) {
  return sendEmail({ to, ...inviteEmail({ name: accountName(user), inviteUrl, expiresAt }) })
}

export async function sendResetEmail({ user, to, resetUrl, expiresAt }) {
  return sendEmail({ to, ...resetEmail({ name: accountName(user), resetUrl, expiresAt }) })
}

export async function sendTestEmail({ user, to }) {
  return sendEmail({ to, ...testEmail({ name: accountName(user) }) })
}

export async function notifyPasswordChanged(user, when = new Date()) {
  return bestEffort('password-changed', () =>
    sendEmail({ to: user.email, ...passwordChangedEmail({ name: accountName(user), when }) })
  )
}

export async function notifyNameChanged(user, previousName, when = new Date()) {
  return bestEffort('name-changed', () =>
    sendEmail({
      to: user.email,
      ...nameChangedEmail({ name: accountName(user), previousName, when }),
    })
  )
}

/**
 * Tell both addresses. The old inbox is the safety net: if someone else
 * changed the sign-in email, its owner finds out before losing the account.
 */
export async function notifyEmailChanged({ user, oldEmail, newEmail, when = new Date() }) {
  const name = accountName(user)
  const results = await Promise.all([
    bestEffort('email-changed-old', () =>
      sendEmail({
        to: oldEmail,
        ...emailChangedEmail({ name, oldEmail, newEmail, audience: 'old', when }),
      })
    ),
    bestEffort('email-changed-new', () =>
      sendEmail({
        to: newEmail,
        ...emailChangedEmail({ name, oldEmail, newEmail, audience: 'new', when }),
      })
    ),
  ])
  return results.some(Boolean)
}
