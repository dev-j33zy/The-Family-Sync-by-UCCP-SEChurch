import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { requireAdmin } from '@/lib/api-auth'
import { assignMemberCode } from '@/lib/member-code'
import { applyMembershipRules, cleanMemberInput } from '@/lib/member-input'
import { applyMemberPhoto, deleteMemberImage } from '@/lib/images'
import { serializeMember, serializeRelationship } from '@/lib/serialize'

async function loadRelationships(memberId, { Relationship, Member, FamilyGroup }) {
  const rels = await Relationship.find({ member_id: memberId })
    .sort({ created_at: 1 })
    .lean()

  if (!rels.length) return []

  const relatedIds = rels.map(r => r.related_member_id)
  const relatedMembers = await Member.find({ _id: { $in: relatedIds } }).lean()
  const memberById = new Map(relatedMembers.map(m => [String(m._id), m]))

  const groupIds = relatedMembers.map(m => m.family_group_id).filter(Boolean)
  const groups = groupIds.length
    ? await FamilyGroup.find({ _id: { $in: groupIds } }).lean()
    : []
  const groupById = new Map(groups.map(g => [String(g._id), g]))

  return rels.map(rel => {
    const related = memberById.get(String(rel.related_member_id))
    const group = related?.family_group_id
      ? groupById.get(String(related.family_group_id))
      : null
    return serializeRelationship(rel, related, group)
  })
}

export async function GET(request, { params }) {
  try {
    const { Member, Relationship, FamilyGroup } = await modelsFor('members')

    const { id } = await params
    const memberId = oid(id)
    if (!memberId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { user, response } = await requireAdmin(request)
    if (response) return response

    const member = await Member.findById(memberId)
      .populate('family_group_id', 'name')
      .lean()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const relationships_list = await loadRelationships(memberId, {
      Member,
      Relationship,
      FamilyGroup,
    })

    return NextResponse.json({
      ...serializeMember(member),
      relationships_list,
    })
  } catch (err) {
    console.error('member detail error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { Member, Relationship } = await modelsFor('members')

    const { id } = await params
    const memberId = oid(id)
    if (!memberId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const body = await request.json()

    const { user, response } = await requireAdmin(request)
    if (response) return response

    applyMembershipRules(body)

    const { values, photo, error } = cleanMemberInput(body)
    if (error) return NextResponse.json({ error }, { status: 400 })

    if (!Object.keys(values).length && photo === undefined) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const existing = await Member.findById(memberId).lean()
    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (Object.keys(values).length) {
      await Member.findByIdAndUpdate(
        memberId,
        { $set: values },
        { returnDocument: 'after', runValidators: true }
      )
    }

    // Photo uploads/removals live in the images cluster.
    await applyMemberPhoto(memberId, photo, Member)

    // Re-assign the member code when the membership date changes.
    if ('date_of_membership' in body) {
      await assignMemberCode(memberId)
    }

    // Keep the spouse's anniversary / marital status in sync.
    if ('wedding_anniversary' in body || 'relationship_status' in body) {
      const spouses = await Relationship.find({
        member_id: memberId,
        relationship_type: 'spouse',
      }).lean()

      for (const rel of spouses) {
        const update = {}
        if ('wedding_anniversary' in body) {
          update.wedding_anniversary = values.wedding_anniversary ?? null
        }
        if ('relationship_status' in body) {
          update.relationship_status =
            body.relationship_status === 'married' ? 'married' : 'single'
        }
        if (Object.keys(update).length) {
          await Member.updateOne({ _id: rel.related_member_id }, { $set: update })
        }
      }
    }

    const member = await Member.findById(memberId)
      .populate('family_group_id', 'name')
      .lean()

    return NextResponse.json(serializeMember(member))
  } catch (err) {
    console.error('member update error:', err)
    const status = err.name === 'ValidationError' || err.code === 11000 ? 400 : 500
    return NextResponse.json({ error: err.message }, { status })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { Member, Relationship } = await modelsFor('members')

    const { id } = await params
    const memberId = oid(id)
    if (!memberId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { user, response } = await requireAdmin(request)
    if (response) return response

    const member = await Member.findById(memberId).lean()
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Remove relationships in both directions, the member, then its photo.
    await Relationship.deleteMany({
      $or: [{ member_id: memberId }, { related_member_id: memberId }],
    })
    await Member.deleteOne({ _id: memberId })
    await deleteMemberImage(memberId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('member delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
