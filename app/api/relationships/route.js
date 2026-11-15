import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { RELATIONSHIP_TYPES } from '@/lib/models/relationship'
import { authUser } from '@/lib/auth'
import { serializeRelationship } from '@/lib/serialize'

// A relationship type says what `related_member_id` is to `member_id` (e.g.
// Marvin's "father" is Genelle's father). The mirror row describes the reverse.
const INVERSE_TYPES = {
  spouse: 'spouse',
  father: 'child',
  mother: 'child',
  sibling: 'sibling',
}

// "child" has no single inverse — the parent's own gender decides whether the
// child's record reads father or mother. "grandchild" cannot be mirrored either,
// because the model has no grandparent type (and the tree has no such slot).
async function inverseTypeFor(type, memberId, Member) {
  if (type !== 'child') return INVERSE_TYPES[type]
  const parent = await Member.findById(memberId, 'gender').lean()
  return parent?.gender === 'female' ? 'mother' : 'father'
}

async function describe(rel, { Member, FamilyGroup }) {
  const related = await Member.findById(rel.related_member_id).lean()
  const group = related?.family_group_id
    ? await FamilyGroup.findById(related.family_group_id).lean()
    : null
  return serializeRelationship(rel, related, group)
}

export async function GET(request) {
  try {
    const { FamilyGroup, Member, Relationship } = await modelsFor('members')

    const user = await authUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memberIdParam = searchParams.get('member_id')

    const filter = {}
    if (memberIdParam) {
      const memberId = oid(memberIdParam)
      if (!memberId) return NextResponse.json([])
      filter.member_id = memberId
    }

    const rels = await Relationship.find(filter).sort({ created_at: -1 }).lean()
    if (!rels.length) return NextResponse.json([])

    const relatedIds = rels.map(rel => rel.related_member_id)
    const relatedMembers = await Member.find({ _id: { $in: relatedIds } }).lean()
    const memberById = new Map(relatedMembers.map(m => [String(m._id), m]))

    const groupIds = relatedMembers.map(m => m.family_group_id).filter(Boolean)
    const groups = groupIds.length
      ? await FamilyGroup.find({ _id: { $in: groupIds } }).lean()
      : []
    const groupById = new Map(groups.map(g => [String(g._id), g]))

    return NextResponse.json(
      rels.map(rel => {
        const related = memberById.get(String(rel.related_member_id))
        const group = related?.family_group_id
          ? groupById.get(String(related.family_group_id))
          : null
        return serializeRelationship(rel, related, group)
      })
    )
  } catch (err) {
    console.error('relationships list error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { FamilyGroup, Member, Relationship } = await modelsFor('members')

    const user = await authUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const memberId = oid(body.member_id)
    const relatedMemberId = oid(body.related_member_id)
    const type = body.relationship_type

    if (!memberId || !relatedMemberId || !type) {
      return NextResponse.json(
        { error: 'member_id, related_member_id, and relationship_type are required' },
        { status: 400 }
      )
    }
    if (!RELATIONSHIP_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid relationship type' }, { status: 400 })
    }

    const rel = await Relationship.findOneAndUpdate(
      {
        member_id: memberId,
        related_member_id: relatedMemberId,
        relationship_type: type,
      },
      {
        $setOnInsert: {
          member_id: memberId,
          related_member_id: relatedMemberId,
          relationship_type: type,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean()

    // Mirror the relationship on the other member.
    const inverseType = await inverseTypeFor(type, memberId, Member)
    if (inverseType && RELATIONSHIP_TYPES.includes(inverseType)) {
      await Relationship.updateOne(
        {
          member_id: relatedMemberId,
          related_member_id: memberId,
          relationship_type: inverseType,
        },
        {
          $setOnInsert: {
            member_id: relatedMemberId,
            related_member_id: memberId,
            relationship_type: inverseType,
          },
        },
        { upsert: true }
      )
    }

    // Keep a married couple's anniversary and status in sync.
    if (type === 'spouse') {
      const [a, b] = await Promise.all([
        Member.findById(memberId).lean(),
        Member.findById(relatedMemberId).lean(),
      ])

      const anniversary = a?.wedding_anniversary || b?.wedding_anniversary || null
      const married =
        a?.relationship_status === 'married' || b?.relationship_status === 'married'

      await Promise.all([
        Member.updateOne(
          { _id: memberId },
          {
            $set: {
              wedding_anniversary: anniversary,
              relationship_status: married ? 'married' : 'single',
            },
          }
        ),
        Member.updateOne(
          { _id: relatedMemberId },
          {
            $set: {
              wedding_anniversary: anniversary,
              relationship_status: married ? 'married' : 'single',
            },
          }
        ),
      ])
    }

    return NextResponse.json(await describe(rel, { Member, FamilyGroup }), { status: 201 })
  } catch (err) {
    console.error('relationship create error:', err)
    const status = err.name === 'ValidationError' || err.code === 11000 ? 400 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}
