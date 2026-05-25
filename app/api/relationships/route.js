import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const member_id = searchParams.get('member_id')

    let query = supabase
      .from('relationships')
      .select(`
        id,
        relationship_type,
        related_member:related_member_id (
          id, first_name, last_name, middle_name,
          date_of_birth, gender, membership_status, membership_type,
          family_groups(name)
        )
      `)

    if (member_id) query = query.eq('member_id', member_id)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    // Insert the relationship
    const { data, error } = await supabase
      .from('relationships')
      .insert([body])
      .select()
      .single()

    if (error) throw error

    // Mirror inverse relationships
    const inverseMap = {
      spouse: 'spouse',
      father: 'child',
      mother: 'child',
      child: null, // parent is set by user
      sibling: 'sibling',
      grandchild: null,
    }
    const inverseType = inverseMap[body.relationship_type]
    if (inverseType) {
      await supabase.from('relationships').upsert([
        {
          member_id: body.related_member_id,
          related_member_id: body.member_id,
          relationship_type: inverseType,
        }
      ], { onConflict: 'member_id,related_member_id,relationship_type', ignoreDuplicates: true })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
