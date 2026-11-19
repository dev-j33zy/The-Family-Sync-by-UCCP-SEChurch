import { NextResponse } from 'next/server'
import { escapeRegex, oid, toPlain } from '@/lib/db'
import { modelsFor } from '@/lib/models'
import { requireAdmin } from '@/lib/api-auth'
import { serializeMember } from '@/lib/serialize'

export async function GET(request) {
  try {
    const { FamilyGroup, Member } = await modelsFor('members')

    const { user, response } = await requireAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const groupFilter = search
      ? { name: new RegExp(escapeRegex(search), 'i') }
      : {}

    const groups = await FamilyGroup.find(groupFilter)
      .collation({ locale: 'en', strength: 2 })
      .sort({ name: 1 })
      .lean()

    const groupIds = groups.map(group => group._id)
    const members = groupIds.length
      ? await Member.find({ family_group_id: { $in: groupIds } })
          .collation({ locale: 'en', strength: 2 })
          .sort({ last_name: 1, first_name: 1 })
          .lean()
      : []

    const membersByGroup = new Map()
    for (const member of members) {
      const key = String(member.family_group_id)
      if (!membersByGroup.has(key)) membersByGroup.set(key, [])
      membersByGroup.get(key).push(serializeMember(member))
    }

    const result = groups.map(group => ({
      ...toPlain(group),
      members: membersByGroup.get(String(group._id)) || [],
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('family groups list error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { FamilyGroup, Member } = await modelsFor('members')

    const { user, response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const group = await FamilyGroup.create({
      name: body.name,
      description: body.description || null,
    })

    return NextResponse.json({ ...toPlain(group), members: [] }, { status: 201 })
  } catch (err) {
    console.error('family group create error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { FamilyGroup, Member } = await modelsFor('members')

    const { user, response } = await requireAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const groupId = oid(searchParams.get('id'))
    if (!groupId) {
      return NextResponse.json({ error: 'Invalid family group id' }, { status: 400 })
    }

    // Same behaviour as the old `ON DELETE SET NULL` foreign key.
    await Member.updateMany(
      { family_group_id: groupId },
      { $set: { family_group_id: null } }
    )
    await FamilyGroup.deleteOne({ _id: groupId })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('family group delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
