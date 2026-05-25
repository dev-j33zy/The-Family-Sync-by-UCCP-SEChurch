// =============================================
// DATE & AGE UTILITIES
// =============================================

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '—'
  const parseStr = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'
  const date = new Date(parseStr)
  if (isNaN(date.getTime())) return 'Invalid Date'
  const defaults = { year: 'numeric', month: 'long', day: 'numeric' }
  return date.toLocaleDateString('en-US', { ...defaults, ...options })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  const parseStr = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'
  const date = new Date(parseStr)
  if (isNaN(date.getTime())) return 'Invalid Date'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateInput(dateStr) {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

// =============================================
// EVENT UTILITIES
// =============================================

export function getUpcomingEvents(members, daysAhead = 7) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const events = []

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
          detail: `Turns ${calculateAge(member.date_of_birth) + 1}`,
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
        const years = today.getFullYear() - new Date(member.wedding_anniversary).getFullYear() + (thisYear.getFullYear() > today.getFullYear() ? 1 : 0)
        events.push({
          type: 'anniversary',
          name: fullName,
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
  // month is 0-indexed
  const events = {}
  members.forEach(member => {
    const fullName = `${member.first_name} ${member.last_name}`

    if (member.date_of_birth) {
      const dob = new Date(member.date_of_birth + 'T00:00:00')
      if (dob.getMonth() === month) {
        const day = dob.getDate()
        if (!events[day]) events[day] = []
        events[day].push({ type: 'birthday', name: fullName, memberId: member.id })
      }
    }

    if (member.wedding_anniversary && member.relationship_status === 'married') {
      const ann = new Date(member.wedding_anniversary + 'T00:00:00')
      if (ann.getMonth() === month) {
        const day = ann.getDate()
        if (!events[day]) events[day] = []
        events[day].push({ type: 'anniversary', name: fullName, memberId: member.id })
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
  const parts = [member.first_name, member.middle_name, member.last_name]
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
