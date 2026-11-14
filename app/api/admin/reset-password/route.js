import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import { authUser, destroyUserSessions, generateTempPassword, hashPassword } from '@/lib/auth'

export async function POST(request) {
  try {
    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { User } = await modelsFor('admin')

    const normalizedEmail = email.trim().toLowerCase()

    const target = await User.findOne({ email: normalizedEmail }).lean()
    if (!target) {
      return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)

    await User.updateOne({ _id: target._id }, { $set: { password_hash: passwordHash } })
    await destroyUserSessions(target._id)

    return NextResponse.json({
      message: 'Password reset successfully. Share the temporary password with them.',
      tempPassword,
    })
  } catch (err) {
    console.error('reset-password error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
