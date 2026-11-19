import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const SESSION_COOKIE = 'fsync_session'
export const SESSION_TTL_DAYS = 30

// =============================================
// SESSION TOKENS
// =============================================

function generateToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function cookieOptions(request) {
  const proto = request?.headers?.get('x-forwarded-proto') || 'http'
  return {
    httpOnly: true,
    // Lax cookies are not sent on cross-site POSTs, which is the first layer
    // of CSRF defence (proxy.js adds an explicit Origin check on top).
    sameSite: 'lax',
    // Do not depend on a client-supplied forwarding header for the Secure
    // flag: in production the cookie is always HTTPS-only.
    secure: process.env.NODE_ENV === 'production' || proto === 'https',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  }
}

export function setSessionCookie(response, token, request) {
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(request))
  return response
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    // Match the attributes of the cookie being cleared, or browsers can keep
    // the old Secure copy and the user is never really signed out.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}

// =============================================
// SESSION CRUD (admin cluster)
// =============================================

export async function createSession(userId) {
  const { Session } = await modelsFor('admin')
  const token = generateToken()
  const expires_at = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await Session.create({
    token_hash: hashToken(token),
    user_id: oid(userId),
    expires_at,
  })

  return token
}

export async function destroySession(token) {
  if (!token) return
  const { Session } = await modelsFor('admin')
  await Session.deleteOne({ token_hash: hashToken(token) })
}

export async function destroyOtherSessions(userId, keepToken) {
  const { Session } = await modelsFor('admin')
  const filter = { user_id: oid(userId) }
  if (keepToken) filter.token_hash = { $ne: hashToken(keepToken) }
  await Session.deleteMany(filter)
}

export async function destroyUserSessions(userId) {
  const { Session } = await modelsFor('admin')
  await Session.deleteMany({ user_id: oid(userId) })
}

// =============================================
// AUTH HELPERS (route handlers / server)
// =============================================

export function tokenFromRequest(request) {
  return request?.cookies?.get(SESSION_COOKIE)?.value || null
}

export async function authUser(request) {
  const token = tokenFromRequest(request)
  if (!token) return null

  const { Session, User } = await modelsFor('admin')

  const session = await Session.findOne({
    token_hash: hashToken(token),
    expires_at: { $gt: new Date() },
  }).lean()
  if (!session) return null

  const user = await User.findById(session.user_id).lean()
  if (!user) return null

  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    display_name: user.display_name ?? null,
    created_at: user.created_at ?? null,
  }
}

// Optimistic check for Proxy (edge runtime) — presence only, no DB access.
export function hasSessionCookie(request) {
  return !!tokenFromRequest(request)
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// =============================================
// PASSWORD HASHING
// =============================================

// Cost 10 was comfortable for a workstation; 12 keeps offline cracking of a
// stolen hash expensive while still verifying in a few hundred milliseconds.
// Existing hashes keep their embedded cost and continue to verify.
const BCRYPT_ROUNDS = 12

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password, hash) {
  if (!password || !hash) return false
  return bcrypt.compare(password, hash)
}

/**
 * Real bcrypt hash of a value nobody can sign in with. Comparing against it
 * when an address does not exist makes login take the same time either way,
 * so response timing cannot be used to enumerate accounts.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$Rip4PehDiq7vLUgo.r0rkeOp707KvgQWhAe1KTigXJemeejqfvg5i'

export async function verifyPasswordForUnknownUser(password) {
  return bcrypt.compare(String(password ?? ''), DUMMY_PASSWORD_HASH)
}

// Generates a human-friendly temporary password (no ambiguous chars).
export function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  let out = ''
  for (const n of arr) out += chars[n % chars.length]
  return out
}
