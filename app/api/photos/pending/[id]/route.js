import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { modelsFor } from '@/lib/models'
import { deletePendingPhoto, getPendingPhoto, saveMemberImage } from '@/lib/images'
import { readJson } from '@/lib/validate'
import { securityContext, securityLog } from '@/lib/audit'

// Admin-only preview of a proposed photo.
export async function GET(request, { params }) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const { id } = await params
    const photo = await getPendingPhoto(id)
    if (!photo?.data) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

    const bytes = Buffer.from(photo.data, 'base64')
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': photo.mime_type || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('pending photo preview error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Admin-only decision. Approve writes the bytes to the normal image store and
// marks the member as having a photo; reject simply discards the proposal.
export async function POST(request, { params }) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const { id } = await params
    const photo = await getPendingPhoto(id)
    if (!photo?.data) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

    const { value: body, error: bodyError } = await readJson(request, 4096)
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 })
    const action = body.action
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }

    if (action === 'approve') {
      const dataUrl = `data:${photo.mime_type};base64,${photo.data}`
      const saved = await saveMemberImage(photo.member_id, dataUrl)
      if (!saved) return NextResponse.json({ error: 'Could not save the photo' }, { status: 500 })

      const { Member } = await modelsFor('members')
      await Member.updateOne({ _id: photo.member_id }, { $set: { has_profile_picture: true } })
    }

    await deletePendingPhoto(id)
    securityLog(
      'photo.pending.reviewed',
      securityContext(request, {
        action,
        pending_id: String(photo._id),
        member_id: String(photo.member_id),
        admin: user?.email || '',
      })
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('pending photo review error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
