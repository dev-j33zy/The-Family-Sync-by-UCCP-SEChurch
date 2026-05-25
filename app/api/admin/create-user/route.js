import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function POST(request) {
  try {
    const { first_name, last_name, email } = await request.json()

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminSupabaseClient()

    const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name,
        last_name,
        role: 'Administrator',
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Invitation sent successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        first_name,
        last_name,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
