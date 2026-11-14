import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import {
  authUser,
  tokenFromRequest,
  destroyOtherSessions,
  hashPassword,
  verifyPassword,
} from '@/lib/auth'
import { serializeUser } from '@/lib/serialize'

export async function GET(request) {
  const user = await authUser(request)
  return NextResponse.json({ user: serializeUser(user) })
}

export async function PATCH(request) {
  try {
    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { User } = await modelsFor('admin')

    const body = await request.json()
    const userId = oid(user.id)

    if (body.email !== undefined) {
      const email = (body.email || '').trim().toLowerCase()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
      }
      const existing = await User.findOne({ email, _id: { $ne: userId } }).lean()
      if (existing) {
        return NextResponse.json({ error: 'That email is already in use by another account' }, { status: 409 })
      }
      await User.updateOne({ _id: userId }, { $set: { email } })
    }

    if (body.password !== undefined && body.password !== '') {
      if (!body.current_password) {
        return NextResponse.json({ error: 'Current password is required to change the password' }, { status: 400 })
      }
      const current = await User.findById(userId).lean()
      const valid = await verifyPassword(body.current_password, current?.password_hash)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
      if (String(body.password).length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
      }
      const passwordHash = await hashPassword(body.password)
      await User.updateOne({ _id: userId }, { $set: { password_hash: passwordHash } })

      const token = tokenFromRequest(request)
      await destroyOtherSessions(userId, token)
    }

    if (body.display_name !== undefined || body.first_name !== undefined || body.last_name !== undefined) {
      const update = {}
      if (body.display_name !== undefined) {
        update.display_name = String(body.display_name).slice(0, 100) || null
      }
      if (body.first_name !== undefined) update.first_name = body.first_name || null
      if (body.last_name !== undefined) update.last_name = body.last_name || null

      if (Object.keys(update).length) {
        await User.updateOne({ _id: userId }, { $set: update })
      }
    }

    const updated = await User.findById(userId).lean()
    return NextResponse.json({ user: serializeUser(updated) })
  } catch (err) {
    console.error('update user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
