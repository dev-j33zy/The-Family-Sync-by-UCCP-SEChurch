import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'
import { purgeAuthTokens } from '@/lib/auth-tokens'

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { Session, User } = await modelsFor('admin')

    const normalizedEmail = email.trim().toLowerCase()

    const target = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: oid(user.id) },
    }).lean()
    if (!target) {
      return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
    }

    await Session.deleteMany({ user_id: target._id })
    await purgeAuthTokens(target._id)
    await User.deleteOne({ _id: target._id })

    return NextResponse.json({ message: `User ${email} deleted successfully` })
  } catch (err) {
    console.error('delete-user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
