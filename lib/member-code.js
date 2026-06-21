export async function assignMemberCode(supabase, memberId) {
  const { data: member } = await supabase
    .from('members')
    .select('id, registered_at, date_of_membership')
    .eq('id', memberId)
    .single()

  if (!member) return

  const datePart = member.date_of_membership
    ? member.date_of_membership.replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '')

  const { count: beforeTime } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .lt('registered_at', member.registered_at)

  const { count: sameTime } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('registered_at', member.registered_at)
    .lt('id', memberId)

  const seq = String((beforeTime || 0) + (sameTime || 0) + 1).padStart(3, '0')
  const memberCode = `${datePart}-${seq}`

  await supabase
    .from('members')
    .update({ member_code: memberCode })
    .eq('id', memberId)
}

export async function backfillMemberCodes(supabase) {
  const { data: members } = await supabase
    .from('members')
    .select('id, registered_at, date_of_membership')
    .order('registered_at', { ascending: true })
    .order('id', { ascending: true })

  if (!members) return 0

  let count = 0
  for (const member of members) {
    if (member.member_code) continue

    const datePart = member.date_of_membership
      ? member.date_of_membership.replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '')

    const seq = String(count + 1).padStart(3, '0')
    const memberCode = `${datePart}-${seq}`

    await supabase
      .from('members')
      .update({ member_code: memberCode })
      .eq('id', member.id)

    count++
  }

  return count
}
