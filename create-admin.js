// Create (or update) the admin user directly in MongoDB.
// Run: node create-admin.js <email> [--password PASSWORD] [--role ROLE]
// Env overrides: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ROLE
// Reads MONGODB_URI from .env.local. If no password is given, one is generated.
//
// NOTE: the `role` enum only permits 'Administrator', so that is the default.

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { registerPathHooks } from './scripts/register-path-hooks.mjs'

function usage() {
  console.error('Usage: node create-admin.js <email> [--password PASSWORD] [--role ROLE]')
  console.error('Env overrides: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ROLE')
  process.exit(1)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const out = { email: null, role: null, password: null, help: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--role') { out.role = args[++i]; continue }
    if (a === '--password') { out.password = args[++i]; continue }
    if (a === '-h' || a === '--help') { out.help = true; continue }
    if (!a.startsWith('-') && !out.email) { out.email = a; continue }
    if (!a.startsWith('-')) { console.error('Unexpected argument: ' + a); out.help = true }
  }
  return out
}

async function main() {
  const opts = parseArgs(process.argv)
  if (opts.help) return usage()

  registerPathHooks()

  const { disconnectDB } = await import('./lib/db.js')
  const { hashPassword, generateTempPassword } = await import('./lib/auth.js')
  const { modelsFor } = await import('./lib/models/index.js')

  const email = (opts.email || process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  if (!email) {
    console.error('Missing email. Provide it as the first argument or via ADMIN_EMAIL.')
    return usage()
  }

  const role = (opts.role || process.env.ADMIN_ROLE || 'Administrator').trim()

  const plain = opts.password || process.env.ADMIN_PASSWORD || generateTempPassword()
  const passwordHash = await hashPassword(plain)

  const { User } = await modelsFor('admin')

  const existing = await User.findOne({ email }).lean()
  if (existing) {
    await User.updateOne(
      { _id: existing._id },
      { $set: { password_hash: passwordHash, role } }
    )
  } else {
    await User.create({ email, password_hash: passwordHash, role })
  }

  const user = await User.findOne({ email }).lean()
  if (!user) {
    console.error('Failed to create/update admin user.')
    process.exit(1)
  }

  console.log(existing ? 'Admin user updated.' : 'Admin user created.')
  console.log('Credentials:')
  console.log('  Email:     ' + user.email)
  console.log('  Password:  ' + plain)
  console.log('  Role:      ' + user.role)
  console.log('User ID: ' + user._id)

  // Close the connection so the process exits instead of idling on the socket.
  await disconnectDB()
}

main().catch((err) => {
  console.error('create-admin error:', err)
  process.exit(1)
})
