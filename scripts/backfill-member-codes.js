// Run: node scripts/backfill-member-codes.js
// Reads MONGODB_URI from .env.local. Reuses lib/member-code.backfillMemberCodes().

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { registerPathHooks } from './register-path-hooks.mjs'

async function main() {
  registerPathHooks()

  const { disconnectDB } = await import('../lib/db.js')
  const { backfillMemberCodes } = await import('../lib/member-code.js')
  const { modelsFor } = await import('../lib/models/index.js')

  const { Member } = await modelsFor('members')

  const total = await Member.countDocuments()
  console.log(`Found ${total} member(s). Assigning codes...`)

  const count = await backfillMemberCodes()

  console.log(`\nDone! Assigned ${count} member code(s).`)

  await disconnectDB()
}

main().catch((err) => {
  console.error('backfill-member-codes error:', err)
  process.exit(1)
})
