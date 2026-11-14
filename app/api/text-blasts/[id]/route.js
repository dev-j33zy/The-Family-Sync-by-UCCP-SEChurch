import { NextResponse } from 'next/server'
import { oid, toPlain } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'
import { SMS_ENABLED } from '@/lib/features'

export async function GET(request, { params }) {
  if (!SMS_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { MessageBlast, MessageBlastRecipient } = await modelsFor('members')

    const { id } = await params
    const blastId = oid(id)
    if (!blastId) {
      return NextResponse.json({ error: 'Blast not found' }, { status: 404 })
    }

    const user = await authUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const blast = await MessageBlast.findById(blastId).lean()
    if (!blast) {
      return NextResponse.json({ error: 'Blast not found' }, { status: 404 })
    }

    // The creator lives in the admin cluster: resolve it manually.
    let creator = null
    if (blast.created_by) {
      const { User } = await modelsFor('admin')
      const creatorDoc = await User.findById(blast.created_by)
        .select('display_name first_name last_name')
        .lean()
      creator = creatorDoc ? toPlain(creatorDoc) : null
    }

    const plain = toPlain(blast)
    plain.created_by = creator ? creator.id : plain.created_by ?? null
    plain.sender_name = creator
      ? creator.display_name ||
        [creator.first_name, creator.last_name].filter(Boolean).join(' ') ||
        null
      : null

    const recipients = await MessageBlastRecipient.find({ blast_id: blastId }).lean()

    // Match the old `ORDER BY member_name NULLS LAST, created_at`.
    recipients.sort((a, b) => {
      const aName = a.member_name || '\uffff'
      const bName = b.member_name || '\uffff'
      if (aName !== bName) return aName.localeCompare(bName)
      return new Date(a.created_at) - new Date(b.created_at)
    })

    return NextResponse.json({
      ...plain,
      recipients: recipients.map(toPlain),
    })
  } catch (err) {
    console.error('text blast detail error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
