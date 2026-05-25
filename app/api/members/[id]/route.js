import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('members')
      .select('*, family_groups(id, name)')
      .eq('id', id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 404 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    // Strip joined/relation fields that are not actual members columns
    const MEMBER_COLUMNS = [
      'first_name', 'last_name', 'middle_name', 'date_of_birth', 'gender', 'citizenship',
      'relationship_status', 'wedding_anniversary',
      'communicant_class_graduate',
      'date_of_membership', 'membership_status', 'membership_type',
      'phone_number', 'email_address', 'home_address', 'family_group_id',
      'profile_picture',
    ]

    // Auto-set membership status/type based on date_of_membership
    if (body.date_of_membership) {
      if (body.membership_status === 'new') {
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

    // Clean empty strings to null and strip non-column fields
    const cleaned = Object.fromEntries(
      Object.entries(body)
        .filter(([k]) => MEMBER_COLUMNS.includes(k))
        .map(([k, v]) => [k, v === '' ? null : v])
    )

    const { data, error } = await supabase
      .from('members')
      .update(cleaned)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Sync wedding_anniversary with spouse
    if ('wedding_anniversary' in body) {
      const { data: rels } = await supabase
        .from('relationships')
        .select('related_member_id')
        .eq('member_id', id)
        .eq('relationship_type', 'spouse')

      if (rels && rels.length > 0) {
        const spouseId = rels[0].related_member_id
        const spouseUpdate = { wedding_anniversary: cleaned.wedding_anniversary }
        if (cleaned.relationship_status === 'married') {
          spouseUpdate.relationship_status = 'married'
        } else if (!cleaned.wedding_anniversary && body.relationship_status !== 'married') {
          spouseUpdate.relationship_status = 'single'
        }
        await supabase.from('members').update(spouseUpdate).eq('id', spouseId)
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
