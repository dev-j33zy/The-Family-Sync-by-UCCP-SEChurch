import { NextResponse } from 'next/server'

// Small in-memory fixed-window limiter for the public endpoints (login,
// registration, member search). It is intentionally dependency-free: on a
// serverless host each instance keeps its own window, which still stops
// trivial brute force and scripted spam. A cluster-wide limit would need a
// shared store.
const buckets = new Map()
const MAX_BUCKETS = 5000

function prune(now) {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  // Still full of live windows: drop the oldest entries.
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
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }

  bucket.count += 1
  return { allowed: true, retryAfter: 0 }
}

/** Best-effort client address: Vercel sets x-forwarded-for. */
export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

/** 429 response with a Retry-After header. */
export function tooManyRequests(retryAfter) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again in a moment.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
