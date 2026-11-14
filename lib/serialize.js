import { dateOnly, toPlain } from './db.js'

const MEMBER_DATE_FIELDS = [
  'date_of_birth',
  'wedding_anniversary',
  'date_of_membership',
]

/** Public user shape used by the auth and admin endpoints. */
export function serializeUser(user) {
  const u = toPlain(user)
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    display_name: u.display_name || u.first_name || u.email || null,
    created_at: u.created_at ?? null,
  }
}

/**
 * URL of a member's photo, served by app/api/images/[id]/route.js.
 * The `v` query mirrors `updated_at` so browsers refresh after an upload.
 */
export function memberPhotoUrl(member) {
  if (!member?.has_profile_picture) return null
  const id = String(member.id ?? member._id)
  const version = member.updated_at ? new Date(member.updated_at).getTime() : null
  return version ? `/api/images/${id}?v=${version}` : `/api/images/${id}`
}

/**
 * Member shape returned to the client. Date fields become YYYY-MM-DD strings
 * and a populated `family_group_id` is exposed both as an id and as
 * `family_groups: { id, name }`, which is what the pages read.
 *
 * `profile_picture` is a short URL (or null); the bytes never leave the
 * images cluster except through /api/images/<id>.
 */
export function serializeMember(doc) {
  const member = toPlain(doc)
  if (!member) return null

  let group = null
  const fg = member.family_group_id
  if (fg && typeof fg === 'object') {
    group = { id: String(fg.id ?? fg._id), name: fg.name }
    member.family_group_id = group.id
  } else if (fg) {
    member.family_group_id = String(fg)
  } else {
    member.family_group_id = null
  }

  for (const field of MEMBER_DATE_FIELDS) {
    member[field] = dateOnly(member[field])
  }

  member.profile_picture = memberPhotoUrl(member)
  delete member.has_profile_picture

  if (member.member_code === undefined) member.member_code = null
  member.family_groups = group
  return member
}

/**
 * Relationship shape returned by the relationship endpoints: the stored row
 * plus the related member (and their family group) inlined.
 */
export function serializeRelationship(rel, related, relatedGroup = null) {
  const result = toPlain(rel)
  if (!result) return null

  if (related) {
    const member = toPlain(related)
    result.related_member = {
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      middle_name: member.middle_name || null,
      date_of_birth: dateOnly(member.date_of_birth),
      gender: member.gender || null,
    }
    // Kept for the member detail page, which reads the spouse fields directly.
    result.spouse_first_name = member.first_name
    result.spouse_last_name = member.last_name
    result.spouse_wedding_anniversary = dateOnly(member.wedding_anniversary)
  }

  result.related_member_family_groups = relatedGroup
    ? { id: String(relatedGroup.id ?? relatedGroup._id), name: relatedGroup.name }
    : null

  return result
}
