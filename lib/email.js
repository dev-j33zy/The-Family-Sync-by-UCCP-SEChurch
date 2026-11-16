import crypto from 'crypto'

// =============================================
// GMAIL API SENDER
//
// Sends transactional mail (invites, password resets, account notifications)
// through the church's Google Workspace mailbox.
//
// Setup (see README → Email):
//   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET  OAuth client from a Google Cloud
//                                          project with the Gmail API enabled.
//   GMAIL_REFRESH_TOKEN                    refresh token from `node
//                                          scripts/gmail-auth.js`.
//   EMAIL_FROM                             "Name <address>" to send as. The
//                                          address must be the authorized
//                                          mailbox or a verified "Send mail
//                                          as" alias on it.
//
// Deliberately dependency-free: the OAuth refresh-token exchange and the MIME
// body are a few dozen lines, and this keeps the serverless bundle small.
// =============================================

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

let cachedToken = null // { value, expiresAt }

function setting(name) {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

export function emailConfigured() {
  return Boolean(
    setting('GMAIL_CLIENT_ID') &&
      setting('GMAIL_CLIENT_SECRET') &&
      setting('GMAIL_REFRESH_TOKEN') &&
      setting('EMAIL_FROM')
  )
}

function sender() {
  const raw = setting('EMAIL_FROM')
  if (!raw) throw new Error('EMAIL_FROM is not set')

  // Accepts "Name <address>" or a bare address.
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(raw)
  if (match) {
    return { name: match[1] || null, address: match[2].trim() }
  }
  return { name: null, address: raw }
}

async function accessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const body = new URLSearchParams({
    client_id: setting('GMAIL_CLIENT_ID'),
    client_secret: setting('GMAIL_CLIENT_SECRET'),
    refresh_token: setting('GMAIL_REFRESH_TOKEN'),
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
    throw new Error(`Gmail authorization failed (${detail}). Check GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN.`)
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  }
  return cachedToken.value
}

// RFC 2047 — non-ASCII headers (subject, display name) must be encoded.
function encodeHeader(value) {
  const text = String(value ?? '')
  if (/^[\x20-\x7E]*$/.test(text)) return text
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`
}

function wrapBase64(base64, width = 76) {
  return base64.replace(new RegExp(`(.{${width}})`, 'g'), '$1\r\n').replace(/\r\n$/, '')
}

function buildMime({ to, subject, text, html, replyTo }) {
  const from = sender()
  const domain = from.address.split('@')[1] || 'localhost'
  const boundary = `fsync_${crypto.randomBytes(12).toString('hex')}`
  const messageId = `<${crypto.randomUUID()}@${domain}>`

  const headers = [
    `From: ${from.name ? `${encodeHeader(from.name)} <${from.address}>` : from.address}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'X-Mailer: The Family Sync',
  ]
  if (replyTo) headers.push(`Reply-To: ${replyTo}`)
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(text, 'utf8').toString('base64')),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(Buffer.from(html, 'utf8').toString('base64')),
    `--${boundary}--`,
    '',
  ]

  return `${headers.join('\r\n')}\r\n\r\n${body.join('\r\n')}`
}

/**
 * Send one email through the Gmail API.
 *
 * @param {{ to: string, subject: string, text: string, html: string, replyTo?: string }} message
 * @returns {Promise<{ id: string }>}
 */
export async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!emailConfigured()) {
    throw new Error('Email is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and EMAIL_FROM.')
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) {
    throw new Error(`Invalid recipient address: ${to}`)
  }

  const raw = buildMime({ to, subject, text, html, replyTo })

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken({ forceRefresh: attempt > 0 })

    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: Buffer.from(raw, 'utf8').toString('base64url') }),
      signal: AbortSignal.timeout(20_000),
    })

    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      return { id: data.id || null }
    }

    // A stale cached token is worth one retry; everything else is fatal.
    if (res.status === 401 && attempt === 0) {
      cachedToken = null
      continue
    }

    const data = await res.json().catch(() => ({}))
    const detail = data?.error?.message || data.error || `HTTP ${res.status}`
    throw new Error(`Gmail rejected the message (${detail}).`)
  }

  throw new Error('Gmail rejected the message (authorization failed).')
}
