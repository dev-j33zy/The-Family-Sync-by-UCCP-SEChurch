// =============================================
// SMS FORMATTING (pure, isomorphic)
//
// Safe to import from both server and client components. Anything that
// touches the network or provider credentials lives in lib/sms.js instead.
// =============================================

const GSM_BASIC = /^[\x20-\x7E\n\r]*$/
const GSM_EXTENDED = /^[\x20-\x7E\n\r@£$¥èéùìòÇÆØøÅå]*$/

export const MAX_MESSAGE_LENGTH = 1600

const SEGMENT_LENGTH_GSM = 160
const SEGMENT_LENGTH_UNICODE = 70
const SEGMENT_OVERHEAD_GSM = 153
const SEGMENT_OVERHEAD_UNICODE = 67

// Family Sync is a Philippine congregation, so local mobile formats are
// assumed by default. NEXT_PUBLIC_ prefix keeps this overridable client-side.
const DEFAULT_COUNTRY_CODE =
  process.env.NEXT_PUBLIC_SMS_DEFAULT_COUNTRY_CODE ||
  process.env.SMS_DEFAULT_COUNTRY_CODE ||
  '63'

// =============================================
// PHONE NORMALIZATION
// =============================================

export function normalizePhone(raw) {
  if (!raw) return null

  const trimmed = String(raw).trim()
  if (!trimmed) return null

  // Keep digits only, remembering whether the source was already
  // international so we can tell +63... apart from a local 63... prefix.
  const hadPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')

  if (!digits) return null

  if (hadPlus) {
    return digits.length >= 8 ? `+${digits}` : null
  }

  // Strip the domestic trunk prefix. Applies to mobiles (0917...) and
  // landlines (02 8...) alike, so gate on length rather than assuming
  // 11 digits.
  if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 11) {
    digits = digits.slice(1)
  }

  // 639171234567 -> already carries the country code
  if (
    digits.startsWith(DEFAULT_COUNTRY_CODE) &&
    digits.length >= DEFAULT_COUNTRY_CODE.length + 9
  ) {
    return `+${digits}`
  }

  // Anything left is a local number with no country code.
  if (digits.length < 7) return null

  return `+${DEFAULT_COUNTRY_CODE}${digits}`
}

export function isCallablePhone(raw) {
  return normalizePhone(raw) !== null
}

// =============================================
// TEMPLATE RENDERING
// =============================================

const TEMPLATE_TOKENS = ['first_name', 'last_name', 'full_name', 'member_code']

export const TEMPLATE_TOKEN_LIST = TEMPLATE_TOKENS

export function renderTemplate(template, member = {}) {
  if (!template) return ''

  const firstName = member.first_name || ''
  const lastName = member.last_name || ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  return template
    .replace(/\{first_name\}/gi, firstName)
    .replace(/\{last_name\}/gi, lastName)
    .replace(/\{full_name\}/gi, fullName)
    .replace(/\{member_code\}/gi, member.member_code || '')
    // Drop any token we do not recognise so members never see raw braces.
    .replace(/\{[a-z0-9_]+\}/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// =============================================
// SEGMENT ESTIMATION
// =============================================

export function countCharacters(body) {
  return [...String(body || '')].length
}

export function estimateSegments(body) {
  const text = String(body || '')
  if (!text.length) return 0

  // Gateways count characters, not UTF-16 code units — an emoji is one
  // character but two units, so iterate code points to avoid over-counting.
  const length = countCharacters(text)

  // A message counts as single-segment only if it fits the GSM alphabets.
  const isUnicode = !GSM_BASIC.test(text) && !GSM_EXTENDED.test(text)

  const singleLength = isUnicode ? SEGMENT_LENGTH_UNICODE : SEGMENT_LENGTH_GSM
  const multipartLength = isUnicode ? SEGMENT_OVERHEAD_UNICODE : SEGMENT_OVERHEAD_GSM

  if (length <= singleLength) return 1

  return Math.ceil(length / multipartLength)
}

export function isOverLimit(body) {
  return countCharacters(body) > MAX_MESSAGE_LENGTH
}
