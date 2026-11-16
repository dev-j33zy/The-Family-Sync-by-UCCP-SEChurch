import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { User } = await modelsFor('admin')

    const users = await User.find({ role: 'Administrator' })
      .sort({ first_name: 1, last_name: 1 })
      .lean()

    const admins = users.map(u => ({
      id: String(u._id),
      email: u.email,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      created_at: u.created_at,
      email_verified_at: u.email_verified_at || null,
      invited_at: u.invited_at || null,
      password_changed_at: u.password_changed_at || null,
      last_login_at: u.last_login_at || null,
    }))

    return NextResponse.json({ admins })
  } catch (err) {
    console.error('list-users error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
