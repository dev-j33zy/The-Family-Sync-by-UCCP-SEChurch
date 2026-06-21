// Run: node scripts/backfill-member-codes.js
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: members, error } = await supabase
    .from('members')
    .select('id, registered_at, date_of_membership, member_code')
    .order('registered_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) { console.error('Fetch error:', error); process.exit(1) }
  if (!members || members.length === 0) { console.log('No members found.'); return }

  console.log(`Found ${members.length} members. Assigning codes...`)

  let count = 0
  for (const member of members) {
    if (member.member_code) {
      count++
      continue
    }

    const datePart = member.date_of_membership
      ? member.date_of_membership.replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '')

    const seq = String(count + 1).padStart(3, '0')
    const memberCode = `${datePart}-${seq}`

    const { error: updateError } = await supabase
      .from('members')
      .update({ member_code: memberCode })
      .eq('id', member.id)

    if (updateError) {
      console.error(`Failed for ${member.id}:`, updateError)
    } else {
      console.log(`  ${member.id.slice(0, 8)}... → ${memberCode}`)
    }

    count++
  }

  console.log(`\nDone! Assigned ${count} member code(s).`)
}

main()
