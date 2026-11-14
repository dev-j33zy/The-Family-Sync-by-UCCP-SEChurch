import mongoose from 'mongoose'
import { Types } from 'mongoose'

// =============================================
// CONNECTIONS
//
// The app spans three Atlas clusters:
//   admin   -> users + sessions
//   members -> family groups, members, relationships, message blasts
//   images  -> profile photo bytes
//
// Each domain has its own cached connection so a request only pays for the
// clusters it actually touches.
// =============================================

const DOMAIN_ENV = {
  admin: 'MONGODB_URI',
  members: 'MONGODB_URI_MEMBERS',
  images: 'MONGODB_URI_IMAGES',
}

export const DB_DOMAINS = Object.keys(DOMAIN_ENV)

// Survive Next.js hot reloads without leaking sockets.
const globalForMongo = globalThis
const cache = globalForMongo.__familySyncMongo || (globalForMongo.__familySyncMongo = {})

function entryFor(domain) {
  if (!cache[domain]) cache[domain] = { conn: null, promise: null }
  return cache[domain]
}

function uriFor(domain) {
  const key = DOMAIN_ENV[domain]
  if (!key) throw new Error(`Unknown database domain: ${domain}`)

  const uri = process.env[key]
  if (!uri) {
    throw new Error(
      `${key} is not set. Add the ${domain} cluster connection string to .env.local (see .env.local.example).`
    )
  }
  return uri
}

/**
 * Connect to one of the app's clusters. Safe to call on every request.
 * @param {'admin'|'members'|'images'} domain
 */
export async function connectDB(domain = 'admin') {
  const entry = entryFor(domain)

  if (entry.conn && entry.conn.readyState === 1) return entry.conn

  if (!entry.promise) {
    const conn = mongoose.createConnection(uriFor(domain), {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    })
    entry.conn = conn
    entry.promise = conn.asPromise()
  }

  try {
    await entry.promise
  } catch (err) {
    const conn = entry.conn
    entry.conn = null
    entry.promise = null
    await conn?.close().catch(() => {})
    throw err
  }

  return entry.conn
}

/**
 * Close every cached connection. Scripts must call this so `node` exits;
 * Next.js requests should never call it.
 */
export async function disconnectDB() {
  await Promise.all(
    Object.values(cache).map(async entry => {
      const conn = entry.conn
      entry.conn = null
      entry.promise = null
      if (conn) await conn.close().catch(() => {})
    })
  )
}

// =============================================
// HELPERS
// =============================================

/** Convert a value to an ObjectId, or return null when it is not a valid id. */
export function oid(value) {
  if (!value) return null
  if (value instanceof Types.ObjectId) return value
  const str = String(value)
  return Types.ObjectId.isValid(str) ? new Types.ObjectId(str) : null
}

/** True when the value is a usable ObjectId string. */
export function isValidId(value) {
  return !!value && Types.ObjectId.isValid(String(value))
}

/**
 * Convert a Mongoose document or lean object into a plain object that uses
 * `id` (string) instead of `_id`, recursively. Dates are left as Date
 * instances so callers can format them as needed.
 */
export function toPlain(value) {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(toPlain)
  if (value instanceof Types.ObjectId) return value.toString()
  if (value instanceof Date) return value

  if (typeof value.toObject === 'function') {
    return toPlain(value.toObject({ virtuals: true }))
  }

  if (typeof value === 'object') {
    const out = {}
    for (const [key, v] of Object.entries(value)) {
      if (key === '__v') continue
      if (key === '_id') {
        out.id = String(v)
        continue
      }
      out[key] = toPlain(v)
    }
    return out
  }

  return value
}

/**
 * Format a date-only field as YYYY-MM-DD.
 *
 * Date-only values are stored at UTC midnight so this renders the same day on
 * every server, whatever its timezone. Values that still carry a time (legacy
 * imports, a Date built at local midnight) fall back to the server's local
 * calendar day instead of silently shifting back a day.
 */
export function dateOnly(value) {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0

  const year = isUtcMidnight ? date.getUTCFullYear() : date.getFullYear()
  const month = isUtcMidnight ? date.getUTCMonth() : date.getMonth()
  const day = isUtcMidnight ? date.getUTCDate() : date.getDate()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const DATE_ONLY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Normalise any date input to UTC midnight of its calendar day.
 *
 * Birthday, anniversary and membership dates are dates, not instants. Storing
 * them as UTC midnight makes `dateOnly()` timezone-independent: a local-midnight
 * Date (which is what `pg`, date pickers and `new Date('YYYY-MM-DD 00:00')`
 * produce) would otherwise serialise as the previous day west of UTC.
 */
export function parseDateOnly(value) {
  if (value == null || value === '') return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const isUtcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    return isUtcMidnight
      ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
      : new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  }

  const str = String(value).trim()
  const match = DATE_ONLY_PREFIX.exec(str)
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  }

  const date = new Date(str)
  if (Number.isNaN(date.getTime())) return null
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** Escape a user string so it can be embedded in a RegExp. */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
