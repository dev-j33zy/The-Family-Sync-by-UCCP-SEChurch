import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminSupabaseClient()

    const { data: userList, error: lookupError } = await adminSupabase.auth.admin.listUsers()
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 })
    }

    const target = userList.users.find(u => u.email === email.toLowerCase())
    if (!target) {
      return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
    }

    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(target.id)
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ message: `User ${email} deleted successfully` })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
