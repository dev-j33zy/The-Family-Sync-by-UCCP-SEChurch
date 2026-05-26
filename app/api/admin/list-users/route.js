import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET(request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminSupabaseClient()
    const { data, error } = await adminSupabase.auth.admin.listUsers()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const admins = data.users
      .filter(u => u.user_metadata?.role === 'Administrator')
      .map(u => ({
        id: u.id,
        email: u.email,
        first_name: u.user_metadata?.first_name || '',
        last_name: u.user_metadata?.last_name || '',
        created_at: u.created_at,
      }))

    return NextResponse.json({ admins })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
