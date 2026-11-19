// =============================================
// INPUT VALIDATION
//
// Route handlers must not put request data straight into a Mongo query or a
// document. These helpers return primitives with hard length/count limits and
// reject the keys used for prototype pollution. They are deliberately small
// and dependency-free so they can be used in both Node and edge code.
// =============================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

/** Normalised email address, or null when the value is not a valid address. */
export function cleanEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null
}

/** Trimmed string capped at `max` characters; null for non-strings/empty. */
export function cleanText(value, max = 200) {
  if (typeof value !== 'string') return null
  const text = value.trim().slice(0, max)
  return text || null
}

/** True when the value is one of the allowed strings (enum check). */
export function oneOf(value, allowed) {
  return typeof value === 'string' && allowed.includes(value)
}

/** Array of ObjectId-shaped strings, capped so a request cannot fan out queries. */
export function idList(value, max = 2000) {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => typeof item === 'string' && /^[A-Za-z0-9]{24}$/.test(item))
    .slice(0, max)
}

/** Integer from a query parameter, clamped to [min, max]. */
export function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/**
 * Copy only the allowed flat keys out of a request object. Values must be
 * strings; anything else (including Mongo operator objects such as {$ne:...})
 * is dropped. Objects carrying prototype-pollution keys are rejected entirely.
 *
 *   const filters = safeObject(body.filters, ['search', 'status'])
 */
export function safeObject(value, allowedKeys, maxLength = 200) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  if (Object.keys(value).some(key => UNSAFE_KEYS.has(key))) return {}

  const allowed = new Set(allowedKeys)
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (!allowed.has(key) || typeof item !== 'string') continue
    out[key] = item.slice(0, maxLength)
  }
  return out
}

/** True when a parsed object contains keys that could pollute a prototype. */
export function hasUnsafeKeys(value) {
  if (!value || typeof value !== 'object') return false
  return Object.keys(value).some(key => UNSAFE_KEYS.has(key))
}

/**
 * Parse a JSON body with a hard size limit and prototype-pollution check.
 * Returns `{ value }` or `{ error }`; callers should return 400 on error.
 * Vercel caps request bodies at the platform level too, but this keeps a
 * malformed or hostile payload from reaching Mongoose on other hosts.
 */
export async function readJson(request, maxBytes = 256 * 1024) {
  try {
    const declared = Number(request.headers?.get?.('content-length') || 0)
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { error: 'Request body is too large' }
    }
    const text = await request.text()
    if (text.length > maxBytes) return { error: 'Request body is too large' }

    const value = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value) || hasUnsafeKeys(value)) {
      return { error: 'Invalid request body' }
    }
    return { value }
  } catch {
    return { error: 'Invalid request body' }
  }
}
