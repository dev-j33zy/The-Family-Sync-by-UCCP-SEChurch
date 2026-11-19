import { NextResponse } from 'next/server'
import { escapeRegex, oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'
import { assignMemberCode } from '@/lib/member-code'
import { applyMembershipRules, cleanMemberInput } from '@/lib/member-input'
import { applyMemberPhoto } from '@/lib/images'
import { serializeMember } from '@/lib/serialize'
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit'
import { readJson } from '@/lib/validate'

// The public register page only needs enough to spot an existing record, so do
// not hand out birthday lists to anyone who guesses a common surname.
const PUBLIC_FIELDS = 'first_name last_name date_of_birth'
const PUBLIC_TERM_MIN = 2
const PUBLIC_RESULT_LIMIT = 20

function nameFilter(term) {
  const pattern = new RegExp(`(^|\\s)${escapeRegex(term)}`, 'i')
  return { $or: [{ first_name: pattern }, { last_name: pattern }] }
}

export async function GET(request) {
  try {
    const { Member } = await modelsFor('members')

    const { searchParams } = new URL(request.url)

    const user = await authUser(request)
    const search = (searchParams.get('search') || '').trim()
    const gender = searchParams.get('gender')
    const publicSearch = !user && search

    if (!user && !publicSearch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filter = {}

    if (publicSearch) {
      // Unauthenticated: throttle so the single-letter prefixes cannot be
      // walked to dump the whole directory.
      const limit = rateLimit(`member-search:${clientIp(request)}`, {
        limit: 60,
        windowMs: 10 * 60 * 1000,
      })
      if (!limit.allowed) return tooManyRequests(limit.retryAfter)

      if (search.length < PUBLIC_TERM_MIN) return NextResponse.json([])

      Object.assign(filter, nameFilter(search))
      // The public register page filters spouse suggestions by gender.
      if (gender) filter.gender = gender
    } else {
      const status = searchParams.get('status')
      const type = searchParams.get('type')
      const familyGroupId = searchParams.get('family_group_id')
      const addressArea = searchParams.get('address_area')

      if (status) filter.membership_status = status
      if (type) filter.membership_type = type
      if (gender) filter.gender = gender

      if (familyGroupId) {
        const groupId = oid(familyGroupId)
        if (!groupId) return NextResponse.json([])
        filter.family_group_id = groupId
      }

      if (addressArea) {
        const pattern = new RegExp(escapeRegex(addressArea), 'i')
        filter.$or = [{ village: pattern }, { barangay: pattern }]
      }

      if (search) {
        const names = nameFilter(search)
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, names]
          delete filter.$or
        } else {
          Object.assign(filter, names)
        }
      }
    }

    let queryBuilder = Member.find(filter)
    if (publicSearch) {
      queryBuilder = queryBuilder.select(PUBLIC_FIELDS).limit(PUBLIC_RESULT_LIMIT)
    } else {
      queryBuilder = queryBuilder.populate('family_group_id', 'name')
    }

    const members = await queryBuilder
      .collation({ locale: 'en', strength: 2 })
      .sort({ last_name: 1, first_name: 1 })
      .lean()

    return NextResponse.json(members.map(serializeMember))
  } catch (err) {
    console.error('members list error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { Member } = await modelsFor('members')

    // Public registration: a household registers a handful of people at most.
    // Staff adding members from the app are signed in and skip the limit.
    const user = await authUser(request)
    if (!user) {
      const limit = rateLimit(`member-register:${clientIp(request)}`, {
        limit: 10,
        windowMs: 60 * 60 * 1000,
      })
      if (!limit.allowed) return tooManyRequests(limit.retryAfter)
    }

    // Public registration: cap the payload and reject Mongo operator keys
    // before any value reaches a model.
    const { value: body, error: bodyError } = await readJson(request, 128 * 1024)
    if (bodyError) return NextResponse.json({ error: bodyError }, { status: 400 })
    applyMembershipRules(body, { creating: true })

    const { values, photo, error } = cleanMemberInput(body)
    if (error) return NextResponse.json({ error }, { status: 400 })

    if (!values.first_name || !values.last_name || !values.date_of_birth) {
      return NextResponse.json(
        { error: 'first_name, last_name, and date_of_birth are required' },
        { status: 400 }
      )
    }

    const created = await Member.create(values)
    await applyMemberPhoto(created._id, photo, Member)
    await assignMemberCode(created._id)

    const member = await Member.findById(created._id)
      .populate('family_group_id', 'name')
      .lean()

    return NextResponse.json(serializeMember(member), { status: 201 })
  } catch (err) {
    console.error('create member error:', err)
    const status = err.name === 'ValidationError' || err.code === 11000 ? 400 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
