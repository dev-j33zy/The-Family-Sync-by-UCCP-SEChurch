import { oid, parseDateOnly } from './db.js'
import { imageDataUrlError } from './images.js'

// Columns the client is allowed to write. `profile_picture` is handled
// separately: the bytes live in the images cluster, not in the member document.
export const MEMBER_FIELDS = [
  'first_name', 'last_name', 'middle_name', 'date_of_birth', 'gender', 'citizenship',
  'relationship_status', 'wedding_anniversary', 'communicant_class_graduate',
  'date_of_membership', 'membership_status', 'membership_type',
  'phone_number', 'email_address', 'street_address', 'village', 'barangay', 'city',
  'family_group_id',
]

// Date-only fields. They are normalised to UTC midnight (see parseDateOnly) so
// the same calendar day is returned no matter which timezone the server runs in.
export const MEMBER_DATE_FIELDS = [
  'date_of_birth',
  'wedding_anniversary',
  'date_of_membership',
]

/**
 * Apply the app's membership rules before writing a member.
 * Mutates and returns the body for convenience.
 */
export function applyMembershipRules(body, { creating = false } = {}) {
  const shouldRecalculate = creating || 'date_of_membership' in body

  if (shouldRecalculate) {
    if (body.date_of_membership) {
      if (!body.membership_status || body.membership_status === 'new') {
        body.membership_status = 'active'
      }
      if (!body.membership_type) {
        body.membership_type = 'regular'
      }
    } else {
      body.membership_status = creating
        ? 'new'
        : body.membership_status || 'new'
      body.membership_type = body.membership_type || null
    }
  }

  // An anniversary only makes sense for married members. On updates, only
  // clear it when the marital status is actually part of the request.
  const shouldClearAnniversary = creating
    ? body.relationship_status !== 'married'
    : 'relationship_status' in body && body.relationship_status !== 'married'

  if (shouldClearAnniversary) {
    body.wedding_anniversary = null
  }

  return body
}

/**
 * Keep only writable fields, turn empty strings into nulls, and normalise the
 * family group reference.
 *
 * Returns `{ values, photo }`: `values` go into the member document, `photo`
 * is the raw `profile_picture` value from the client (undefined when the field
 * was not sent at all) and must be handled by lib/images.applyMemberPhoto().
 * Returns `{ error }` when the family group id is unusable.
 */
export function cleanMemberInput(body) {
  const values = {}
  let photo

  for (const key of MEMBER_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]
    if (MEMBER_DATE_FIELDS.includes(key) && value !== '' && value != null) {
      const parsed = parseDateOnly(value)
      if (!parsed) return { error: `Invalid ${key.replaceAll('_', ' ')}` }
      values[key] = parsed
    } else {
      values[key] = value === '' ? null : value
    }
  }

  if ('profile_picture' in body) {
    photo = body.profile_picture === '' ? null : body.profile_picture
    // Check before the member is written: a rejected photo must not leave a
    // half-saved row behind.
    const photoError = imageDataUrlError(photo)
    if (photoError) return { error: photoError }
  }

  if ('family_group_id' in values && values.family_group_id) {
    const groupId = oid(values.family_group_id)
    if (!groupId) return { error: 'Invalid family group' }
    values.family_group_id = groupId
  } else if ('family_group_id' in values) {
    values.family_group_id = null
  }

  return { values, photo }
}
