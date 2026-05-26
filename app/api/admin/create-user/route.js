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
    const origin = request.headers.get('origin')
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin || `${protocol}://${host}`

    // Create user and send invitation email
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name,
        last_name,
        role: 'Administrator',
      },
      redirectTo: `${appUrl}/auth/callback`,
    })

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Invitation sent via email successfully.',
      user: {
        id: inviteData.user.id,
        email: inviteData.user.email,
        first_name,
        last_name,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
