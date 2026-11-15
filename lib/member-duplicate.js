// Identity used to spot duplicate people: the same full name and birthday is
// the same member. Names are trimmed/case-folded and dates are compared as
// plain YYYY-MM-DD strings so the browser preview and the server apply exactly
// the same rule (this module must stay free of server imports).
export function memberDuplicateKey(member) {
  const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  const firstName = normalize(member?.first_name)
  const lastName = normalize(member?.last_name)
  const dateOfBirth = normalizeDateOnly(member?.date_of_birth)
  if (!firstName || !lastName || !dateOfBirth) return null
  return `${lastName}|${firstName}|${dateOfBirth}`
}

export function normalizeDateOnly(value) {
  if (!value) return ''
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  }
  const text = String(value).trim()
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text)
  return match ? match[1] : text.toLowerCase()
}
