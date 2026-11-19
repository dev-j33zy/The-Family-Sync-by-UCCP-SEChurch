import { NextResponse } from 'next/server'
import { dateOnly } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { assignMemberCode } from '@/lib/member-code'
import { requireAdmin } from '@/lib/api-auth'
import { applyMembershipRules, cleanMemberInput } from '@/lib/member-input'
import { memberDuplicateKey } from '@/lib/member-duplicate'
import { applyMemberPhoto } from '@/lib/images'
import { serializeMember } from '@/lib/serialize'
import { readJson } from '@/lib/validate'
import { securityLog, securityContext } from '@/lib/audit'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'

// A spreadsheet import is a bulk write plus one photo write per row. Cap it so
// a malformed upload cannot monopolise the connection pool or the event loop.
const MAX_IMPORT_ROWS = 500

function conflictSummary(conflicts) {
  const count = conflicts.length
  return `${count} row${count === 1 ? '' : 's'} conflict with existing members or another row in the file, so nothing was imported`
}

export async function POST(request) {
  try {
    const { Member } = await modelsFor('members')

    const { user, response } = await requireAdmin(request)
    if (response) return response

    const limit = rateLimit(`import:${clientIp(request)}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })
    if (!limit.allowed) return tooManyRequests(limit.retryAfter)

    const { value: body, error: bodyError } = await readJson(request, 4 * 1024 * 1024)
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 })
    const members = body.members

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'No members to import' }, { status: 400 })
    }
    if (members.length > MAX_IMPORT_ROWS) {
      securityLog('import.rejected', securityContext(request, { reason: 'too-many-rows', count: members.length }))
      return NextResponse.json(
        { error: `An import may contain at most ${MAX_IMPORT_ROWS} rows. Split the file and try again.` },
        { status: 400 }
      )
    }

    // Validate every row before touching the database: a half-finished import
    // is worse than a rejected one. `_row` is the spreadsheet row number the
    // settings page sends so errors point at the line the user can fix.
    const prepared = []
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index]
      const row = Number(member?._row) || index + 1

      const { values, photo, error } = cleanMemberInput({
        membership_status: 'new',
        ...member,
      })
      if (error) {
        return NextResponse.json({ error: `Row ${row}: ${error}` }, { status: 400 })
      }
      if (!values.first_name || !values.last_name || !values.date_of_birth) {
        return NextResponse.json(
          { error: `Row ${row}: first name, last name, and date of birth are required` },
          { status: 400 }
        )
      }

      applyMembershipRules(values, { creating: true })
      prepared.push({ row, member, values, photo, key: memberDuplicateKey(member) })
    }

    // Duplicate check: against the club's records and against the rest of the
    // same file. Only the three identity fields are read, so this stays cheap.
    const existing = await Member.find({}, 'first_name last_name date_of_birth').lean()
    const existingKeys = new Set(existing.map(memberDuplicateKey).filter(Boolean))

    const seen = new Map()
    const conflicts = []
    for (const item of prepared) {
      if (!item.key) continue
      if (existingKeys.has(item.key)) {
        conflicts.push({
          row: item.row,
          reason: 'existing',
          first_name: item.values.first_name,
          last_name: item.values.last_name,
          date_of_birth: dateOnly(item.values.date_of_birth),
        })
      } else if (seen.has(item.key)) {
        conflicts.push({
          row: item.row,
          reason: 'duplicate',
          duplicate_of: seen.get(item.key),
          first_name: item.values.first_name,
          last_name: item.values.last_name,
          date_of_birth: dateOnly(item.values.date_of_birth),
        })
      } else {
        seen.set(item.key, item.row)
      }
    }

    if (conflicts.length) {
      return NextResponse.json(
        { error: conflictSummary(conflicts), conflicts },
        { status: 409 }
      )
    }

    const inserted = await Member.insertMany(prepared.map(item => item.values))
    for (let i = 0; i < inserted.length; i++) {
      await applyMemberPhoto(inserted[i]._id, prepared[i].photo, Member)
      await assignMemberCode(inserted[i]._id)
    }

    const ids = inserted.map(member => member._id)
    const updated = await Member.find({ _id: { $in: ids } }).lean()

    securityLog('admin.action', securityContext(request, {
      action: 'members.import',
      userId: user.id,
      rows: inserted.length,
    }))

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
