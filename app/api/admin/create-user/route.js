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

    // Generate an invite link directly. This creates the user without triggering the automatic Supabase email.
    // This allows us to get the exact link to display on the screen.
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { 
        data: {
          first_name,
          last_name,
          role: 'Administrator',
        },
        redirectTo: `${appUrl}/auth/callback` 
      },
    })

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    const inviteLink = `${appUrl}/auth/callback?type=invite&token_hash=${linkData.properties.hashed_token}`

    return NextResponse.json({
      message: 'Invite link generated successfully.',
      link: inviteLink,
      user: {
        id: linkData.user.id,
        email: linkData.user.email,
        first_name,
        last_name,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
