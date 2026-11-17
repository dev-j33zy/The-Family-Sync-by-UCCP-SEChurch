// =============================================
// GOOGLE OAUTH (refresh token → access token)
//
// One Google Workspace mailbox authorizes the app once; this module turns the
// stored refresh token into short-lived access tokens for both the Gmail API
// (lib/email.js) and the Sheets/Drive export
// (app/api/export/sheets/route.js).
//
// The scopes live on the token, not on the request, so the same
// GMAIL_REFRESH_TOKEN serves both features. `npm run google-auth` asks for all
// of them in one consent screen.
//
// Deliberately dependency-free: the token exchange is a single POST.
// =============================================

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

let cachedToken = null // { value, expiresAt }

export function googleSetting(name) {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

/** Client credentials and a refresh token are present. */
export function googleConfigured() {
  return Boolean(
    googleSetting('GMAIL_CLIENT_ID') &&
      googleSetting('GMAIL_CLIENT_SECRET') &&
      googleSetting('GMAIL_REFRESH_TOKEN')
  )
}

/** Drop the cached token so the next call mints a new one. */
export function invalidateGoogleToken() {
  cachedToken = null
}

/**
 * Access token for the authorized mailbox, cached until shortly before it
 * expires. Throws a message that says which setting to fix.
 */
export async function googleAccessToken({ forceRefresh = false } = {}) {
  if (!googleConfigured()) {
    throw new Error(
      'Google is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN.'
    )
  }

  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const body = new URLSearchParams({
    client_id: googleSetting('GMAIL_CLIENT_ID'),
    client_secret: googleSetting('GMAIL_CLIENT_SECRET'),
    refresh_token: googleSetting('GMAIL_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`
    if (data.error === 'invalid_grant') {
      throw new Error(
        'Google authorization expired or was revoked (invalid_grant). Re-run `npm run google-auth` and update GMAIL_REFRESH_TOKEN.'
      )
    }
    throw new Error(
      `Google authorization failed (${detail}). Check GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN.`
    )
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  }
  return cachedToken.value
}

/**
 * Shared helper for Google REST calls: returns the parsed body, or throws a
 * message built from Google's error payload.
 */
export async function googleRequest(url, { token, ...init } = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(30_000),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const firstDetail = Array.isArray(data?.error?.details) ? data.error.details[0] : null
    const detail =
      data?.error?.message || (typeof data?.error === 'string' && data.error) || `HTTP ${res.status}`
    const error = new Error(detail)
    error.status = res.status
    error.reason =
      data?.error?.errors?.[0]?.reason || firstDetail?.reason || data?.error?.status || null
    error.service = firstDetail?.metadata?.service || null
    throw error
  }
  return data
}
