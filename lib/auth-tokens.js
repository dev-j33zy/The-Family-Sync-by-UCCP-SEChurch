import crypto from 'crypto'
import { modelsFor } from './models'
import { oid } from './db'

// Invite links need to survive a weekend; reset links should be short-lived.
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000
export const RESET_TTL_MS = 60 * 60 * 1000

const TTL_BY_PURPOSE = { invite: INVITE_TTL_MS, reset: RESET_TTL_MS }

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

/**
 * Create a single-use link token for a user. Any earlier tokens for the same
 * purpose are dropped, so only the newest email in an inbox works.
 *
 * @param {{ userId: string, purpose: 'invite'|'reset', createdBy?: string|null, ip?: string|null }} input
 * @returns {Promise<{ token: string, expiresAt: Date }>}
 */
export async function issueAuthToken({ userId, purpose, createdBy = null, ip = null }) {
  const ttl = TTL_BY_PURPOSE[purpose]
  if (!ttl) throw new Error(`Unknown token purpose: ${purpose}`)

  const { AuthToken } = await modelsFor('admin')

  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + ttl)

  await AuthToken.deleteMany({ user_id: oid(userId), purpose, used_at: null })
  await AuthToken.create({
    token_hash: hashToken(token),
    user_id: oid(userId),
    purpose,
    expires_at: expiresAt,
    created_by: oid(createdBy),
    requested_ip: ip ? String(ip).slice(0, 100) : null,
  })

  return { token, expiresAt }
}

/**
 * Look up a token without consuming it — used by the reset page to decide
 * whether to show the form or an "expired" message.
 *
 * @returns {Promise<{ userId: string, purpose: 'invite'|'reset', expiresAt: Date } | null>}
 */
export async function peekAuthToken(token, purpose = null) {
  if (!token || String(token).length < 20) return null

  const { AuthToken } = await modelsFor('admin')
  const filter = {
    token_hash: hashToken(token),
    used_at: null,
    expires_at: { $gt: new Date() },
  }
  if (purpose) filter.purpose = purpose

  const row = await AuthToken.findOne(filter).lean()
  if (!row) return null

  return {
    userId: String(row.user_id),
    purpose: row.purpose,
    expiresAt: row.expires_at,
  }
}

/**
 * Atomically burn a token. Returns null when it was already used, expired or
 * never existed — the caller must treat all three the same way.
 */
export async function consumeAuthToken(token, purpose = null) {
  if (!token || String(token).length < 20) return null

  const { AuthToken } = await modelsFor('admin')
  const filter = {
    token_hash: hashToken(token),
    used_at: null,
    expires_at: { $gt: new Date() },
  }
  if (purpose) filter.purpose = purpose

  const row = await AuthToken.findOneAndUpdate(
    filter,
    { $set: { used_at: new Date() } },
    { new: true }
  ).lean()

  if (!row) return null

  return {
    userId: String(row.user_id),
    purpose: row.purpose,
    expiresAt: row.expires_at,
  }
}

/** Drop every link belonging to a user (used when an account is deleted). */
export async function purgeAuthTokens(userId) {
  const { AuthToken } = await modelsFor('admin')
  await AuthToken.deleteMany({ user_id: oid(userId) })
}
