import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { requireAdmin } from '@/lib/api-auth'
import { imageDataUrlError, listPendingPhotos, savePendingPhoto } from '@/lib/images'
import { memberDuplicateKey, normalizeDateOnly } from '@/lib/member-duplicate'
import { cleanEmail, cleanText, readJson } from '@/lib/validate'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { securityContext, securityLog } from '@/lib/audit'

// Public: a registrant whose details match an existing member submits the photo
// they picked. The bytes are held for staff review and never applied directly.
export async function POST(request) {
  try {
    const limit = rateLimit(`photo-pending:${clientIp(request)}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const { value: body, error: bodyError } = await readJson(request, 128 * 1024)
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 })

    const memberId = oid(body.member_id)
    if (!memberId) return NextResponse.json({ error: 'Invalid member' }, { status: 400 })

    const photoError = imageDataUrlError(body.photo)
    if (photoError) return NextResponse.json({ error: photoError }, { status: 400 })
    if (typeof body.photo !== 'string' || !body.photo.startsWith('data:')) {
      return NextResponse.json({ error: 'No photo was provided' }, { status: 400 })
    }

    const { Member } = await modelsFor('members')
    const member = await Member.findById(memberId)
      .select('first_name last_name date_of_birth')
      .lean()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Knowing the name and birthday is the same proof the public duplicate
    // check already requires. It stops arbitrary photos being attached to a
    // guessed record; staff still reviews before anything is applied.
    const submitted = {
      first_name: cleanText(body.first_name, 100) || '',
      last_name: cleanText(body.last_name, 100) || '',
      date_of_birth: normalizeDateOnly(body.date_of_birth),
    }
    if (!memberDuplicateKey(submitted) || memberDuplicateKey(submitted) !== memberDuplicateKey(member)) {
      return NextResponse.json(
        { error: 'The details do not match an existing member' },
        { status: 403 }
      )
    }

    const saved = await savePendingPhoto(memberId, body.photo, {
      submitted_name: `${submitted.first_name} ${submitted.last_name}`.trim(),
      submitted_email: cleanEmail(body.email) || '',
    })
    if (!saved) return NextResponse.json({ error: 'That photo could not be saved' }, { status: 400 })

    securityLog('photo.pending.submitted', securityContext(request, { member_id: String(memberId) }))
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('pending photo submit error:', err)
    return NextResponse.json({ error: 'Could not submit photo' }, { status: 500 })
  }
}

// Admin: the review queue. Bytes are intentionally omitted.
export async function GET(request) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const photos = await listPendingPhotos(searchParams.get('member_id') || '')

    // Cross-cluster populate() is not possible, so hydrate display names from
    // the members cluster with a single bounded query.
    const ids = [...new Set(photos.map(p => String(p.member_id)).filter(Boolean))]
    const objectIds = ids.map(oid).filter(Boolean)
    const { Member } = await modelsFor('members')
    const members = objectIds.length
      ? await Member.find({ _id: { $in: objectIds } }).select('first_name last_name').lean()
      : []
    const names = new Map(
      members.map(m => [String(m._id), `${m.first_name || ''} ${m.last_name || ''}`.trim()])
    )

    return NextResponse.json(
      photos.map(p => ({
        id: String(p._id),
        member_id: String(p.member_id),
        member_name: names.get(String(p.member_id)) || p.submitted_name || '',
        submitted_name: p.submitted_name || '',
        submitted_email: p.submitted_email || '',
        byte_size: p.byte_size || 0,
        created_at: p.created_at,
      }))
    )
  } catch (err) {
    console.error('pending photo list error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
