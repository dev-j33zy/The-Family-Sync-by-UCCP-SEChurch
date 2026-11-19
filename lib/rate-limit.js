import { NextResponse } from 'next/server'

// Small in-memory fixed-window limiter for the public endpoints (login,
// registration, member search). It is intentionally dependency-free: on a
// serverless host each instance keeps its own window, which still stops
// trivial brute force and scripted spam. A cluster-wide limit would need a
// shared store.
const buckets = new Map()
const MAX_BUCKETS = 5000
const PRUNE_AT = 1000

function prune(now) {
  // Iterating every bucket on each hit would itself be an amplification
  // vector, so only sweep once the map has grown past a small threshold.
  if (buckets.size < PRUNE_AT) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  // Still full of live windows: drop the oldest entries rather than growing
  // without bound. Map iteration order is insertion order.
  while (buckets.size >= MAX_BUCKETS) {
    buckets.delete(buckets.keys().next().value)
  }
}

/**
 * Count one hit for `key`. Returns `{ allowed, retryAfter }`, where
 * `retryAfter` is in seconds (0 when allowed).
 */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    prune(now)
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    // One line per tripped limit gives log drains something to alert on
    // without recording the key itself (it may contain an email address).
    console.log('[security] ' + JSON.stringify({ at: new Date().toISOString(), event: 'rate.limited', scope: key.split(':')[0] }))
    return { allowed: false, retryAfter }
  }

  bucket.count += 1
  return { allowed: true, retryAfter: 0 }
}

/**
 * Best-effort client address for rate limiting.
 *
 * `x-forwarded-for[0]` is caller-controlled and must not be used to decide who
 * gets a fresh bucket. Vercel overwrites `x-real-ip` with the address it saw,
 * so that is the trusted value in production; the last forwarded entry is the
 * hop added by a proxy and is the next best fallback. A caller can still
 * share an address with other users, which is the safe direction to fail.
 */
export function clientIp(request) {
  const real = String(request.headers?.get?.('x-real-ip') || '').trim()
  if (real) return real.split(',')[0].trim().slice(0, 100)

  const forwarded = String(request.headers?.get?.('x-forwarded-for') || '')
  if (forwarded) {
    const hops = forwarded.split(',').map(part => part.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1].slice(0, 100)
  }

  return String(request.headers?.get?.('x-vercel-forwarded-for') || '').trim().slice(0, 100) || 'unknown'
}

/** 429 response with a Retry-After header. */
export function tooManyRequests(retryAfter) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again in a moment.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
