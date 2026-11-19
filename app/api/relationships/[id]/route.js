import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { requireAdmin } from '@/lib/api-auth'
import { serializeRelationship } from '@/lib/serialize'

export async function GET(request, { params }) {
  try {
    const { FamilyGroup, Member, Relationship } = await modelsFor('members')

    const { user, response } = await requireAdmin(request)
    if (response) return response

    const { id } = await params
    const relId = oid(id)
    if (!relId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const rel = await Relationship.findById(relId).lean()
    if (!rel) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const related = await Member.findById(rel.related_member_id).lean()
    const group = related?.family_group_id
      ? await FamilyGroup.findById(related.family_group_id).lean()
      : null

    return NextResponse.json(serializeRelationship(rel, related, group))
  } catch (err) {
    console.error('relationship get error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { Member, Relationship } = await modelsFor('members')

    const { user, response } = await requireAdmin(request)
    if (response) return response

    const { id } = await params
    const relId = oid(id)
    if (!relId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const rel = await Relationship.findById(relId).lean()
    if (!rel) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await Relationship.deleteOne({ _id: rel._id })
    await Relationship.deleteOne({
      member_id: rel.related_member_id,
      related_member_id: rel.member_id,
      relationship_type: rel.relationship_type,
    })

    // Only one spouse relationship is allowed per pair; clear the anniversary
    // when a member no longer has a spouse.
    if (rel.relationship_type === 'spouse') {
      const stillMarried = await Relationship.exists({
        member_id: rel.member_id,
        relationship_type: 'spouse',
      })
      if (!stillMarried) {
        await Member.updateOne(
          { _id: rel.member_id },
          { $set: { wedding_anniversary: null, relationship_status: 'single' } }
        )
      }

      const partnerStillMarried = await Relationship.exists({
        member_id: rel.related_member_id,
        relationship_type: 'spouse',
      })
      if (!partnerStillMarried) {
        await Member.updateOne(
          { _id: rel.related_member_id },
          { $set: { wedding_anniversary: null, relationship_status: 'single' } }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('relationship delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
