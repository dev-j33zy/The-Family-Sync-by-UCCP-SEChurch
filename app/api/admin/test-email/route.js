import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import { requireAdmin } from '@/lib/api-auth'
import { sendTestEmail } from '@/lib/account-mail'
import { emailConfigured } from '@/lib/email'
import { cleanEmail, readJson } from '@/lib/validate'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

// Lets an administrator confirm the Gmail API setup without creating a throwaway
// account or waiting for a real invite to bounce.
export async function POST(request) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const limit = rateLimit(`admin:test-email:${clientIp(request)}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const { value: body, error: bodyError } = await readJson(request)
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 })
    const to = cleanEmail(body.email)
    if (!to) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    if (!emailConfigured()) {
      return NextResponse.json(
        { error: 'Email is not configured. Set the GMAIL_* variables and EMAIL_FROM.' },
        { status: 503 }
      )
    }

    // The admin looking at the page, for the "requested by" line.
    const { User } = await modelsFor('admin')
    const sender = await User.findById(user.id).lean()

    await sendTestEmail({ user: sender, to })
    return NextResponse.json({ message: `Test email sent to ${to}.` })
  } catch (err) {
    console.error('test-email error:', err)
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
