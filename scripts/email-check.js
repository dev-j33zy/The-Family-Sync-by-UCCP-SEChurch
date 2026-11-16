// Send one test message through the app's own Gmail sender.
//
//   node scripts/email-check.js you@example.com
//
// Reads .env.local, so it exercises exactly the credentials, sender address and
// MIME builder that lib/email.js uses in production. Use it when mail is
// suspected broken — the error text names the failing piece (bad refresh token,
// unverified From address, Gmail rejection) without needing a browser session.

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const { emailConfigured, sendEmail } = await import('../lib/email.js')
const { testEmail } = await import('../lib/email-templates.js')

const to = process.argv[2]

if (!to || to === '--help' || to === '-h') {
  console.error('Usage: node scripts/email-check.js <recipient-address>')
  process.exit(1)
}

function present(name) {
  const value = process.env[name]
  if (!value || !value.trim()) return 'missing'
  return `set (${value.trim().length} chars)`
}

console.log('Configuration')
console.log('  GMAIL_CLIENT_ID     ', present('GMAIL_CLIENT_ID'))
console.log('  GMAIL_CLIENT_SECRET ', present('GMAIL_CLIENT_SECRET'))
console.log('  GMAIL_REFRESH_TOKEN ', present('GMAIL_REFRESH_TOKEN'))
console.log('  EMAIL_FROM          ', process.env.EMAIL_FROM || 'missing')
console.log(
  '  NEXT_PUBLIC_APP_URL ',
  process.env.NEXT_PUBLIC_APP_URL || '(unset — links fall back to the request host)'
)

if (!emailConfigured()) {
  console.error(
    '\n✖ Email is not configured. GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,\n' +
      '  GMAIL_REFRESH_TOKEN and EMAIL_FROM must all be set.'
  )
  process.exit(1)
}

console.log(`\nSending to ${to} …`)
const started = Date.now()

try {
  const result = await sendEmail({ to, ...testEmail({ name: 'email-check.js' }) })
  console.log(`✔ Gmail accepted the message in ${Date.now() - started} ms (id ${result.id})`)
} catch (err) {
  console.error(`✖ Send failed after ${Date.now() - started} ms`)
  console.error(`  ${err.message}`)

  if (/invalid_grant/i.test(err.message)) {
    console.error('  → The refresh token was revoked or expired (password change, 6-month')
    console.error('    idle, or app access removed). Re-run: node scripts/gmail-auth.js')
  } else if (/not allowed|not authorized|permission/i.test(err.message)) {
    console.error('  → EMAIL_FROM is not an address this mailbox may send as.')
    console.error('    Use the mailbox itself or a verified "Send mail as" alias.')
  }

  process.exit(1)
}
