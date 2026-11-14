import { NextResponse } from 'next/server'
import { dateOnly } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const { FamilyGroup, Member, Relationship } = await modelsFor('members')

    const user = await authUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const members = await Member.find(
      {},
      `first_name last_name middle_name date_of_birth wedding_anniversary
       relationship_status membership_type membership_status registered_at`
    )
      .collation({ locale: 'en', strength: 2 })
      .sort({ last_name: 1, first_name: 1 })
      .lean()

    const relationships = await Relationship.find(
      {},
      'member_id related_member_id relationship_type'
    ).lean()

    const memberById = new Map(members.map(m => [String(m._id), m]))

    const spouseMap = {}
    for (const rel of relationships) {
      if (rel.relationship_type !== 'spouse') continue
      const related = memberById.get(String(rel.related_member_id))
      if (related) {
        spouseMap[String(rel.member_id)] = `${related.first_name} ${related.last_name}`
      }
    }

    const resultMembers = members.map(member => ({
      id: String(member._id),
      first_name: member.first_name,
      last_name: member.last_name,
      middle_name: member.middle_name ?? null,
      date_of_birth: dateOnly(member.date_of_birth),
      wedding_anniversary: dateOnly(member.wedding_anniversary),
      relationship_status: member.relationship_status ?? null,
      membership_type: member.membership_type ?? null,
      membership_status: member.membership_status,
      registered_at: member.registered_at,
      spouse_name: spouseMap[String(member._id)] || null,
    }))

    const familyGroups = await FamilyGroup.find({}, 'name')
      .collation({ locale: 'en', strength: 2 })
      .sort({ name: 1 })
      .lean()

    const stats = {
      total: members.length,
      active: members.filter(m => m.membership_status === 'active').length,
      new: members.filter(m => m.membership_status === 'new').length,
      dormant: members.filter(m => m.membership_status === 'dormant').length,
      cancelled: members.filter(m => m.membership_status === 'cancelled').length,
      family_groups_count: familyGroups.length,
    }

    return NextResponse.json({
      stats,
      members: resultMembers,
      family_groups: familyGroups.map(group => ({
        id: String(group._id),
        name: group.name,
      })),
    })
  } catch (err) {
    console.error('dashboard error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
