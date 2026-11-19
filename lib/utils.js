// =============================================
// DATE & AGE UTILITIES
// =============================================

/**
 * Parse an API date value.
 *
 * Date-only strings (YYYY-MM-DD) are parsed as *local* midnight. Parsing them
 * as UTC (`new Date('2000-04-29')`) moves them to the previous day for anyone
 * west of UTC, which would make a birthday show up a day early. Full timestamps
 * keep their own offset.
 */
export function parseDateValue(value) {
  if (!value) return null
  const str = String(value)
  const date = new Date(str.includes('T') ? str : str + 'T00:00:00')
  return Number.isNaN(date.getTime()) ? null : date
}

/** Format a Date as YYYY-MM-DD using its local calendar day. */
export function toDateOnlyString(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const d2 = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${d2}`
}

/** Today as YYYY-MM-DD in the browser's timezone (for date input `max`). */
export function todayDateString() {
  return toDateOnlyString(new Date())
}

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const today = new Date()
  const birth = parseDateValue(dateOfBirth)
  if (!birth) return null
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '—'
  const date = parseDateValue(dateStr)
  if (!date) return 'Invalid Date'
  const defaults = { year: 'numeric', month: 'long', day: 'numeric' }
  return date.toLocaleDateString('en-US', { ...defaults, ...options })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  const date = parseDateValue(dateStr)
  if (!date) return 'Invalid Date'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateInput(dateStr) {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

/**
 * Membership can be recorded as a bare year or a full date. A year becomes
 * January 1 of that year so sorting/filtering keep working; a full date is
 * kept exactly as entered.
 */
export function membershipYearToDate(value) {
  if (!value) return ''
  const text = String(value).trim()

  const yearOnly = /^(\d{4})$/.exec(text)
  if (yearOnly) return `${yearOnly[1]}-01-01`

  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (full) {
    const date = new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3]))
    const valid =
      date.getFullYear() === Number(full[1]) &&
      date.getMonth() === Number(full[2]) - 1 &&
      date.getDate() === Number(full[3])
    if (valid) return `${full[1]}-${full[2]}-${full[3]}`
  }

  return ''
}

export function membershipDateToYear(value) {
  if (!value) return ''
  const match = /^(\d{4})/.exec(String(value).trim())
  return match ? match[1] : ''
}

/**
 * What the membership form field should show for an existing record: a bare
 * year when the stored date is January 1 (the year-only convention), otherwise
 * the full date.
 */
export function membershipDateToInput(value) {
  if (!value) return ''
  const text = String(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return membershipDateToYear(value)
  return text.endsWith('-01-01') ? text.slice(0, 4) : text
}

/**
 * Membership input may be a 4-digit year or a complete date. Both must fall
 * between 1900 and the current year and describe a real calendar date.
 */
export function isValidMembershipDate(value) {
  if (!value) return true
  const text = String(value).trim()
  const yearMatch = /^(\d{4})(?:-\d{2}-\d{2})?$/.exec(text)
  if (!yearMatch) return false
  const year = Number(yearMatch[1])
  if (year < 1900 || year > new Date().getFullYear()) return false
  return !!membershipYearToDate(text)
}

// =============================================
// EVENT UTILITIES
// =============================================

/**
 * Both spouses carry the same wedding anniversary, so an anniversary event has
 * to be de-duplicated or the couple shows up twice. The API gives us the
 * spouse's name (and the widget gets spouse ids), so key the couple by the
 * unordered pair of names.
 */
export function coupleKeyFor(member) {
  const self = `${member.first_name || ''} ${member.last_name || ''}`.trim().toLowerCase()
  const spouse = (member.spouse_name || '').trim().toLowerCase()
  if (!spouse) return null
  return [self, spouse].sort().join('|')
}

/**
 * Age the member turns on `date`'s next occurrence. On the day itself
 * `calculateAge()` already returns the new age, so adding one would over-count.
 */
function ageTurning(dateOfBirth, occurrence) {
  const birth = parseDateValue(dateOfBirth)
  if (!birth) return null
  return occurrence.getFullYear() - birth.getFullYear()
}

export function getUpcomingEvents(members, daysAhead = 7) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const events = []
  const anniversariesSeen = new Set()

  members.forEach(member => {
    const fullName = `${member.first_name} ${member.last_name}`

    // Birthday
    if (member.date_of_birth) {
      const dob = new Date(member.date_of_birth + 'T00:00:00')
      const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
      const diffDays = Math.round((thisYear - today) / (1000 * 60 * 60 * 24))
      if (diffDays <= daysAhead) {
        events.push({
          type: 'birthday',
          name: fullName,
          memberId: member.id,
          date: thisYear,
          daysAway: diffDays,
          detail: `Turns ${ageTurning(member.date_of_birth, thisYear)}`,
        })
      }
    }

    // Anniversary
    if (member.wedding_anniversary && member.relationship_status === 'married') {
      const ann = new Date(member.wedding_anniversary + 'T00:00:00')
      const thisYear = new Date(today.getFullYear(), ann.getMonth(), ann.getDate())
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
      const diffDays = Math.round((thisYear - today) / (1000 * 60 * 60 * 24))
      if (diffDays <= daysAhead) {
        const coupleKey = coupleKeyFor(member)
        if (coupleKey && anniversariesSeen.has(coupleKey)) return
        if (coupleKey) anniversariesSeen.add(coupleKey)

        const years = ageTurning(member.wedding_anniversary, thisYear)
        const displayName = member.spouse_name
          ? `${fullName} & ${member.spouse_name}`
          : fullName
        events.push({
          type: 'anniversary',
          name: displayName,
          memberId: member.id,
          date: thisYear,
          daysAway: diffDays,
          detail: `${years} year${years !== 1 ? 's' : ''}`,
        })
      }
    }
  })

  return events.sort((a, b) => a.daysAway - b.daysAway)
}

export function getCalendarEvents(members, year, month) {
  const events = {}
  const anniversariesSeen = new Set()

  members.forEach(member => {
    const fullName = `${member.first_name} ${member.last_name}`

    if (member.date_of_birth) {
      const dob = new Date(member.date_of_birth + 'T00:00:00')
      if (dob.getMonth() === month) {
        const day = dob.getDate()
        if (!events[day]) events[day] = []
        events[day].push({ type: 'birthday', name: fullName, memberId: member.id, spouseName: member.spouse_name || null })
      }
    }

    if (member.wedding_anniversary && member.relationship_status === 'married') {
      const ann = new Date(member.wedding_anniversary + 'T00:00:00')
      if (ann.getMonth() === month) {
        const coupleKey = coupleKeyFor(member)
        if (coupleKey && anniversariesSeen.has(coupleKey)) return
        if (coupleKey) anniversariesSeen.add(coupleKey)

        const day = ann.getDate()
        if (!events[day]) events[day] = []
        const displayName = member.spouse_name
          ? `${fullName} & ${member.spouse_name}`
          : fullName
        events[day].push({ type: 'anniversary', name: displayName, memberId: member.id, spouseName: member.spouse_name || null })
      }
    }
  })

  return events
}

// =============================================
// LABEL & COLOR HELPERS
// =============================================

export function getStatusColor(status) {
  switch (status) {
    case 'active': return 'badge-active'
    case 'new': return 'badge-new'
    case 'dormant': return 'badge-dormant'
    case 'cancelled': return 'badge-cancelled'
    default: return 'badge-default'
  }
}

/**
 * Display label for a membership status. The stored value stays `new` for
 * compatibility, but "Preparatory" is what the church calls it.
 */
export function getStatusLabel(status) {
  if (!status) return '—'
  if (status === 'new') return 'Preparatory'
  return capitalize(status)
}

export function getDaysAwayLabel(daysAway) {
  if (daysAway === 0) return 'Today!'
  if (daysAway === 1) return 'Tomorrow'
  return `In ${daysAway} days`
}

export function capitalize(str) {
  if (!str) return '—'
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function getFullName(member) {
  if (!member) return ''
  const parts = [member.first_name, member.middle_name, member.last_name, member.prefix]
  return parts.filter(Boolean).join(' ')
}

export function getRelationshipLabel(type) {
  const map = {
    spouse: 'Spouse',
    father: 'Father',
    mother: 'Mother',
    sibling: 'Sibling',
    child: 'Child',
    grandchild: 'Grandchild',
  }
  return map[type] || type
}

export function renderDatePickerHeader({ date, changeYear, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) {
  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear - 120; y <= currentYear; y++) years.push(y)
  return (
    <div style={{ margin: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button type="button" onClick={decreaseMonth} disabled={prevMonthButtonDisabled}
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px 8px', fontSize: '1rem', lineHeight: 1, opacity: prevMonthButtonDisabled ? 0.3 : 1 }}>‹</button>
      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem', textAlign: 'center' }}>
        {date.toLocaleString('default', { month: 'long' })}
      </span>
      <button type="button" onClick={increaseMonth} disabled={nextMonthButtonDisabled}
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px 8px', fontSize: '1rem', lineHeight: 1, opacity: nextMonthButtonDisabled ? 0.3 : 1 }}>›</button>
      <select value={date.getFullYear()} onChange={e => changeYear(parseInt(e.target.value))}
        style={{ marginLeft: '12px', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
        {years.map(y => (
          <option key={y} value={y} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>{y}</option>
        ))}
      </select>
    </div>
  )
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
