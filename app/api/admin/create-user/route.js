import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import { authUser, generateTempPassword, hashPassword } from '@/lib/auth'
import { serializeUser } from '@/lib/serialize'

export async function POST(request) {
  try {
    const { first_name, last_name, email } = await request.json()

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 })
    }

    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { User } = await modelsFor('admin')

    const normalizedEmail = email.trim().toLowerCase()

    const existing = await User.findOne({ email: normalizedEmail }).lean()
    if (existing) {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)

    const displayName = [first_name, last_name].filter(Boolean).join(' ').trim()

    const created = await User.create({
      email: normalizedEmail,
      password_hash: passwordHash,
      role: 'Administrator',
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      display_name: displayName,
    })

    return NextResponse.json(
      {
        message: 'User created successfully. Share the temporary password with them.',
        tempPassword,
        user: serializeUser(created),
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('create-user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
