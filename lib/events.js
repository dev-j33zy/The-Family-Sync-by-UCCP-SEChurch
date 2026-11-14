import { dateOnly } from '@/lib/db'
import { modelsFor } from '@/lib/models'

// Builds the birthday / anniversary payload shared by the public widget
// endpoint and the authenticated widget endpoint.
export async function getEventsPayload() {
  const { Member, Relationship } = await modelsFor('members')

  const members = await Member.find(
    {},
    'first_name last_name date_of_birth wedding_anniversary relationship_status'
  ).lean()

  const relationships = await Relationship.find(
    {},
    'member_id related_member_id relationship_type'
  ).lean()

  const spouseMap = {}
  for (const rel of relationships) {
    if (rel.relationship_type !== 'spouse') continue
    const from = String(rel.member_id)
    const to = String(rel.related_member_id)
    if (!spouseMap[from]) spouseMap[from] = { ids: [], names: [] }
    spouseMap[from].ids.push(to)
  }

  const memberById = new Map(members.map(m => [String(m._id), m]))

  for (const id of Object.keys(spouseMap)) {
    spouseMap[id].names = spouseMap[id].ids
      .map(spouseId => {
        const spouse = memberById.get(spouseId)
        return spouse ? `${spouse.first_name} ${spouse.last_name}`.trim() : null
      })
      .filter(Boolean)
  }

  const events = members.map(member => {
    const id = String(member._id)
    const spouse = spouseMap[id]
    return {
      id,
      first_name: member.first_name,
      last_name: member.last_name,
      date_of_birth: dateOnly(member.date_of_birth),
      wedding_anniversary: dateOnly(member.wedding_anniversary),
      relationship_status: member.relationship_status ?? null,
      spouse_name: spouse && spouse.names[0] ? spouse.names[0] : null,
      spouse_ids: spouse ? spouse.ids : [],
    }
  })

  return { members: events }
}
