import { dateOnly, oid } from '@/lib/db'
import { modelsFor } from '@/lib/models'

function codeDatePart(member) {
  const source = member.date_of_membership || new Date()
  return dateOnly(source).replace(/-/g, '')
}

export async function assignMemberCode(memberId) {
  const { Member } = await modelsFor('members')

  const id = oid(memberId)
  if (!id) return null

  const member = await Member.findById(id).lean()
  if (!member) return null

  // Sequence is the member's position by registration order, so codes stay
  // stable when members are edited later.
  const before = await Member.countDocuments({
    $or: [
      { registered_at: { $lt: member.registered_at } },
      { registered_at: member.registered_at, _id: { $lt: member._id } },
    ],
  })

  const datePart = codeDatePart(member)
  const memberCode = `${datePart}-${String(before + 1).padStart(3, '0')}`

  await Member.updateOne({ _id: id }, { $set: { member_code: memberCode } })
  return memberCode
}

export async function backfillMemberCodes() {
  const { Member } = await modelsFor('members')

  const members = await Member.find({}, { registered_at: 1, date_of_membership: 1 })
    .sort({ registered_at: 1, _id: 1 })
    .lean()

  // Clear first so re-running cannot collide with the unique member_code index.
  await Member.updateMany({}, { $unset: { member_code: '' } })

  if (!members.length) return 0

  const operations = members.map((member, index) => ({
    updateOne: {
      filter: { _id: member._id },
      update: {
        $set: {
          member_code: `${codeDatePart(member)}-${String(index + 1).padStart(3, '0')}`,
        },
      },
    },
  }))

  await Member.bulkWrite(operations)
  return members.length
}
