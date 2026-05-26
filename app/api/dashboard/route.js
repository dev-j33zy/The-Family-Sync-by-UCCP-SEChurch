import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: members, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, date_of_birth, wedding_anniversary, relationship_status, membership_status, membership_type, registered_at')
      .order('last_name')

    if (error) throw error

    const { data: relationships } = await supabase
      .from('relationships')
      .select('member_id, related_member_id, relationship_type')

    const spouseMap = {}
    if (relationships) {
      const memberById = {}
      members.forEach(m => { memberById[m.id] = m })

      relationships.forEach(r => {
        if (r.relationship_type === 'spouse') {
          const related = memberById[r.related_member_id]
          if (related) {
            spouseMap[r.member_id] = `${related.first_name} ${related.last_name}`
          }
        }
      })
    }

    members.forEach(m => {
      m.spouse_name = spouseMap[m.id] || null
    })

    const stats = {
      total: members.length,
      active: members.filter(m => m.membership_status === 'active').length,
      new: members.filter(m => m.membership_status === 'new').length,
      dormant: members.filter(m => m.membership_status === 'dormant').length,
      cancelled: members.filter(m => m.membership_status === 'cancelled').length,
    }

    return NextResponse.json({ stats, members })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
