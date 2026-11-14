import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import { assignMemberCode } from '@/lib/member-code'
import { authUser } from '@/lib/auth'
import { cleanMemberInput } from '@/lib/member-input'
import { applyMemberPhoto } from '@/lib/images'
import { serializeMember } from '@/lib/serialize'

export async function POST(request) {
  try {
    const { Member } = await modelsFor('members')

    const user = await authUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { members } = await request.json()

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'No members to import' }, { status: 400 })
    }

    const documents = []
    const photos = []
    for (const member of members) {
      const { values, photo, error } = cleanMemberInput({
        membership_status: 'new',
        ...member,
      })
      if (error) return NextResponse.json({ error }, { status: 400 })
      documents.push(values)
      photos.push(photo)
    }

    const inserted = await Member.insertMany(documents)
    for (let i = 0; i < inserted.length; i++) {
      await applyMemberPhoto(inserted[i]._id, photos[i], Member)
      await assignMemberCode(inserted[i]._id)
    }

    const ids = inserted.map(member => member._id)
    const updated = await Member.find({ _id: { $in: ids } }).lean()

    return NextResponse.json({
      data: updated.map(serializeMember),
      count: updated.length,
    })
  } catch (err) {
    console.error('members import error:', err)
    const status = err.name === 'ValidationError' || err.code === 11000 ? 400 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
