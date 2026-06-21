import { createServerSupabaseClient } from '@/lib/supabase-server'
import { assignMemberCode } from '@/lib/member-code'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    let query = supabase
      .from('members')
      .select('*, family_groups(id, name)')
      .order('last_name', { ascending: true })

    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const gender = searchParams.get('gender')
    const search = searchParams.get('search')
    const family_group_id = searchParams.get('family_group_id')
    const address_area = searchParams.get('address_area')

    if (status) query = query.eq('membership_status', status)
    if (type) query = query.eq('membership_type', type)
    if (gender) query = query.eq('gender', gender)
    if (family_group_id) query = query.eq('family_group_id', family_group_id)
    if (address_area) {
      query = query.or(
        `village.ilike.%${address_area}%,barangay.ilike.%${address_area}%`
      )
    }
    if (search) {
      query = query.or(
        `first_name.ilike.${search}%,last_name.ilike.${search}%,first_name.ilike.% ${search}%,last_name.ilike.% ${search}%`
      )
    }

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

    // Auto-set membership_status and membership_type based on date_of_membership
    if (body.date_of_membership) {
      if (!body.membership_status || body.membership_status === 'new') {
        body.membership_status = 'active'
      }
      if (!body.membership_type) {
        body.membership_type = 'regular'
      }
    } else {
      body.membership_status = 'new'
      body.membership_type = body.membership_type || null
    }

    // Clear anniversary if not married
    if (body.relationship_status !== 'married') {
      body.wedding_anniversary = null
    }

    // Clean empty strings to null
    const cleaned = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, v === '' ? null : v])
    )

    const { data, error } = await supabase
      .from('members')
      .insert([cleaned])
      .select()
      .single()

    if (error) throw error

    await assignMemberCode(supabase, data.id)

    const { data: updated } = await supabase
      .from('members')
      .select('*')
      .eq('id', data.id)
      .single()

    return NextResponse.json(updated, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
