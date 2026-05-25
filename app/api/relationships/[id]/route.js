import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // First get the relationship to find the inverse
    const { data: rel } = await supabase
      .from('relationships')
      .select('*')
      .eq('id', id)
      .single()

    if (!rel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete this relationship
    const { error } = await supabase
      .from('relationships')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Delete inverse if it's a mirrored type
    const inverseMap = { spouse: 'spouse', sibling: 'sibling', child: null }
    const inverseType = inverseMap[rel.relationship_type]
    if (inverseType !== undefined && inverseType !== null) {
      await supabase
        .from('relationships')
        .delete()
        .eq('member_id', rel.related_member_id)
        .eq('related_member_id', rel.member_id)
        .eq('relationship_type', inverseType)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
