import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'
import { sendTestEmail } from '@/lib/account-mail'
import { emailConfigured } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Lets an administrator confirm the Gmail API setup without creating a throwaway
// account or waiting for a real invite to bounce.
export async function POST(request) {
  try {
    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email } = await request.json().catch(() => ({}))
    const to = String(email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(to)) {
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
