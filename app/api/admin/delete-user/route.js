import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { requireAdmin } from '@/lib/api-auth'
import { purgeAuthTokens } from '@/lib/auth-tokens'
import { cleanEmail, readJson } from '@/lib/validate'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { securityLog, securityContext } from '@/lib/audit'

export async function POST(request) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const limit = rateLimit(`admin:delete-user:${clientIp(request)}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const { value: body, error: bodyError } = await readJson(request)
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 })
    const normalizedEmail = cleanEmail(body.email)
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const { Session, User } = await modelsFor('admin')

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

    securityLog('admin.action', securityContext(request, {
      action: 'user.delete',
      actorId: user.id,
      subjectId: String(target._id),
    }))

    return NextResponse.json({ message: `User ${normalizedEmail} deleted successfully` })
  } catch (err) {
    console.error('delete-user error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
