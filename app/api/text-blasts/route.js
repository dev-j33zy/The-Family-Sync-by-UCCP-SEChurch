import { NextResponse } from 'next/server'
import { escapeRegex, oid, toPlain } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'
import { SMS_ENABLED } from '@/lib/features'
import { sendSms } from '@/lib/sms'
import { normalizePhone, renderTemplate, isOverLimit } from '@/lib/sms-format'

// A blast is sent inside a single request, so cap the audience. This also
// stops a mis-click from texting the entire membership.
const MAX_RECIPIENTS = 2000
const SEND_CONCURRENCY = 10

function nameFilter(term) {
  const pattern = new RegExp(`(^|\\s)${escapeRegex(term)}`, 'i')
  return { $or: [{ first_name: pattern }, { last_name: pattern }] }
}

// `created_by` points at a user in the admin cluster, so it cannot be
// populated by Mongoose. Resolve the ids with one extra query instead.
async function loadCreators(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))]
  if (!unique.length) return new Map()

  const { User } = await modelsFor('admin')
  const users = await User.find({ _id: { $in: unique.map(oid).filter(Boolean) } })
    .select('display_name first_name last_name')
    .lean()

  return new Map(users.map(user => [String(user._id), user]))
}

// Mirrors the filter set in app/api/members/route.js so the compose page
// can narrow the audience with the same vocabulary the members list uses.
async function resolveRecipients(Member, filters, memberIds) {
  const filter = {}

  if (filters.family_group_id) {
    const groupId = oid(filters.family_group_id)
    if (!groupId) return []
    filter.family_group_id = groupId
  }
  if (filters.status) filter.membership_status = filters.status
  if (filters.type) filter.membership_type = filters.type
  if (filters.gender) filter.gender = filters.gender

  if (filters.address_area) {
    const pattern = new RegExp(escapeRegex(filters.address_area), 'i')
    filter.$or = [{ village: pattern }, { barangay: pattern }, { city: pattern }]
  }

  if (filters.search) {
    const names = nameFilter(filters.search)
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, names]
      delete filter.$or
    } else {
      Object.assign(filter, names)
    }
  }

  // An explicit pick always wins over the filters, but the filters still
  // apply so a stale selection cannot reach someone outside the audience.
  if (Array.isArray(memberIds) && memberIds.length > 0) {
    const ids = memberIds.map(oid).filter(Boolean)
    if (!ids.length) return []
    filter._id = { $in: ids }
  }

  return Member.find(filter, 'first_name last_name member_code phone_number')
    .collation({ locale: 'en', strength: 2 })
    .sort({ last_name: 1, first_name: 1 })
    .limit(MAX_RECIPIENTS + 1)
    .lean()
}

async function runInBatches(items, batchSize, worker) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(worker))
  }
}

function senderName(creator) {
  if (!creator) return null
  return (
    creator.display_name ||
    [creator.first_name, creator.last_name].filter(Boolean).join(' ') ||
    null
  )
}

function serializeBlast(blast) {
  const plain = toPlain(blast)
  if (!plain) return null

  const creator =
    plain.created_by && typeof plain.created_by === 'object' ? plain.created_by : null
  plain.created_by = creator ? creator.id : plain.created_by ?? null
  plain.sender_name = senderName(creator)
  return plain
}

export async function GET(request) {
  if (!SMS_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { MessageBlast } = await modelsFor('members')

    const user = await authUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)

    const blasts = await MessageBlast.find()
      .sort({ created_at: -1 })
      .limit(limit)
      .lean()

    const creators = await loadCreators(blasts.map(blast => blast.created_by))

    return NextResponse.json(
      blasts.map(blast => {
        const creator = blast.created_by
          ? creators.get(String(blast.created_by)) || null
          : null
        return serializeBlast({ ...blast, created_by: creator || blast.created_by })
      })
    )
  } catch (err) {
    console.error('text blasts list error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  if (!SMS_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { Member, MessageBlast, MessageBlastRecipient } = await modelsFor('members')

    const user = await authUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    if (isOverLimit(message)) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 })
    }

    const filters = body.filters && typeof body.filters === 'object' ? body.filters : {}
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds : []

    const members = await resolveRecipients(Member, filters, memberIds)

    if (members.length === 0) {
      return NextResponse.json(
        { error: 'No members matched the selected audience' },
        { status: 400 }
      )
    }
    if (members.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `Audience is too large. Narrow the filters to ${MAX_RECIPIENTS} members or fewer.` },
        { status: 400 }
      )
    }

    // Members without a usable number are recorded as skipped rather than
    // dropped, so the history explains why the count is lower than the pick.
    const prepared = members.map(member => {
      const phone = normalizePhone(member.phone_number)
      const rendered = renderTemplate(message, member)
      return {
        memberId: member._id,
        memberName: [member.first_name, member.last_name].filter(Boolean).join(' '),
        phone,
        rendered,
        status: phone ? 'pending' : 'skipped',
        error: phone
          ? null
          : member.phone_number
            ? `Unusable phone number: ${member.phone_number}`
            : 'No phone number on file',
      }
    })

    const blast = await MessageBlast.create({
      message,
      audience: { filters, pickedManually: memberIds.length > 0 },
      recipient_count: prepared.length,
      status: 'sending',
      created_by: oid(user.id),
    })

    const inserted = await MessageBlastRecipient.insertMany(
      prepared.map(recipient => ({
        blast_id: blast._id,
        member_id: recipient.memberId,
        member_name: recipient.memberName,
        phone_number: recipient.phone,
        rendered_message: recipient.rendered,
        status: recipient.status,
        error: recipient.error,
      }))
    )

    const results = inserted.map(doc => ({
      id: doc._id,
      phone: doc.phone_number,
      body: doc.rendered_message,
      status: doc.status,
      error: null,
      sid: null,
    }))

    const sendable = results.filter(result => result.status === 'pending')

    await runInBatches(sendable, SEND_CONCURRENCY, async result => {
      const outcome = await sendSms({ to: result.phone, body: result.body })
      if (outcome.ok) {
        result.status = 'sent'
        result.sid = outcome.sid
      } else {
        result.status = 'failed'
        result.error = outcome.error
      }
    })

    if (results.length) {
      await MessageBlastRecipient.bulkWrite(
        results.map(result => ({
          updateOne: {
            filter: { _id: result.id },
            update: {
              $set: {
                status: result.status,
                error: result.error,
                provider_sid: result.sid,
              },
            },
          },
        }))
      )
    }

    const sent = results.filter(result => result.status === 'sent').length
    const failed = results.filter(result => result.status === 'failed').length
    const skipped = results.filter(result => result.status === 'skipped').length

    // Clean send, a total failure, or anything in between.
    let status = 'partial'
    if (sent > 0 && failed === 0 && skipped === 0) status = 'sent'
    else if (sent === 0 && failed > 0) status = 'failed'

    const updated = await MessageBlast.findByIdAndUpdate(
      blast._id,
      {
        $set: {
          status,
          sent_count: sent,
          failed_count: failed,
          skipped_count: skipped,
        },
      },
      { returnDocument: 'after' }
    ).lean()

    return NextResponse.json({ blast: toPlain(updated) }, { status: 201 })
  } catch (err) {
    console.error('text blast send error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
