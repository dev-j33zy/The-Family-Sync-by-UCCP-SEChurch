// =============================================
// SMS TRANSPORT (server only)
//
// Every outbound message goes through sendSms(). The default provider is
// 'log': it records the message in the server console and reports success,
// so the whole blast pipeline can be exercised end to end without an
// account at any gateway.
//
// To go live, set SMS_PROVIDER=twilio plus TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER. Nothing outside this file
// needs to change.
//
// Do not import this from a client component — it reads provider
// credentials. Shared pure helpers live in lib/sms-format.js.
// =============================================

import { estimateSegments } from '@/lib/sms-format'

export const PROVIDER = process.env.SMS_PROVIDER || 'log'

function logSid() {
  return `log_${Math.random().toString(36).slice(2, 12)}`
}

async function sendViaLog({ to, body }) {
  console.log(`[sms:log] to=${to} segments=${estimateSegments(body)} :: ${body}`)
  return { ok: true, sid: logSid() }
}

async function sendViaTwilio({ to, body }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: 'Twilio credentials are not configured' }
  }

  const params = new URLSearchParams({ To: to, From: from, Body: body })
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    }
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    return { ok: false, error: data.message || `Twilio error ${response.status}` }
  }

  return { ok: true, sid: data.sid }
}

const PROVIDERS = {
  log: sendViaLog,
  twilio: sendViaTwilio,
}

export async function sendSms({ to, body }) {
  const send = PROVIDERS[PROVIDER] || sendViaLog

  try {
    return await send({ to, body })
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
