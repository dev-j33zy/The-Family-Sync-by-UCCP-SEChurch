// =============================================
// STATE
// =============================================
let members = []
let settings = {}
let supabaseUrl = ''
let supabaseKey = ''
let viewYear = new Date().getFullYear()
let viewMonth = new Date().getMonth()
let refreshInterval = null

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// =============================================
// INIT
// =============================================
async function init() {
  const env = await window.electronAPI.getEnv()
  supabaseUrl = env.url
  supabaseKey = env.key

  settings = await window.electronAPI.getSettings()
  applySettings(settings)

  setupTitleBar()
  setupTabs()
  setupCalendarNav()
  setupSettingsUI()
  setupResize()

  await fetchMembers()
  renderListView()
  renderCalendarView()

  // Auto-refresh every 30 minutes
  refreshInterval = setInterval(fetchMembers, 30 * 60 * 1000)

  window.electronAPI.onSettingsUpdated((s) => {
    settings = s
    applySettings(s)
  })
}

// =============================================
// SUPABASE FETCH
// =============================================
async function fetchMembers() {
  const btn = document.getElementById('btn-refresh')
  btn.style.transform = 'rotate(360deg)'
  btn.style.transition = 'transform 0.3s'

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/members?select=id,first_name,last_name,date_of_birth,wedding_anniversary,relationship_status,spouse_name`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    members = await res.json()
  } catch (err) {
    console.error('Fetch failed:', err)
    document.getElementById('events-list').innerHTML =
      `<div class="empty-state"><div class="empty-state-icon">&#9888;</div><div>Failed to load data.<br>Check .env or connection.</div></div>`
  }

  setTimeout(() => { btn.style.transform = '' }, 300)
  renderListView()
  renderCalendarView()
}

// =============================================
// EVENT CALCULATIONS (mirrors lib/utils.js)
// =============================================
function calculateAge(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  const birth = new Date(dateStr + 'T00:00:00')
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function getUpcomingEvents(daysAhead = 7) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const events = []

  for (const m of members) {
    const fullName = `${m.first_name} ${m.last_name}`

    if (m.date_of_birth) {
      const dob = new Date(m.date_of_birth + 'T00:00:00')
      const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
      const diff = Math.round((thisYear - today) / (1000 * 60 * 60 * 24))
      if (diff <= daysAhead) {
        events.push({
          type: 'birthday',
          name: fullName,
          date: thisYear,
          daysAway: diff,
          detail: `Turns ${calculateAge(m.date_of_birth) + 1}`,
        })
      }
    }

    if (m.wedding_anniversary && m.relationship_status === 'married') {
      const ann = new Date(m.wedding_anniversary + 'T00:00:00')
      const thisYear = new Date(today.getFullYear(), ann.getMonth(), ann.getDate())
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
      const diff = Math.round((thisYear - today) / (1000 * 60 * 60 * 24))
      if (diff <= daysAhead) {
        const years = today.getFullYear() - ann.getFullYear() + (thisYear.getFullYear() > today.getFullYear() ? 1 : 0)
        events.push({
          type: 'anniversary',
          name: fullName,
          date: thisYear,
          daysAway: diff,
          detail: `${years} year${years !== 1 ? 's' : ''}`,
        })
      }
    }
  }

  return events.sort((a, b) => a.daysAway - b.daysAway)
}

function getCalendarEvents(year, month) {
  const events = {}
  for (const m of members) {
    const fullName = `${m.first_name} ${m.last_name}`

    if (m.date_of_birth) {
      const dob = new Date(m.date_of_birth + 'T00:00:00')
      if (dob.getMonth() === month) {
        const day = dob.getDate()
        if (!events[day]) events[day] = []
        events[day].push({ type: 'birthday', name: fullName })
      }
    }

    if (m.wedding_anniversary && m.relationship_status === 'married') {
      const ann = new Date(m.wedding_anniversary + 'T00:00:00')
      if (ann.getMonth() === month) {
        const day = ann.getDate()
        if (!events[day]) events[day] = []
        if (!events[day].some(e => e.type === 'anniversary' && e.name === fullName)) {
          events[day].push({ type: 'anniversary', name: fullName })
        }
      }
    }
  }

  return events
}

// =============================================
// LIST VIEW
// =============================================
function renderListView() {
  const container = document.getElementById('events-list')
  const events = getUpcomingEvents(7)

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#127881;</div>
        <div>No birthdays or anniversaries in the next 7 days</div>
      </div>`
    return
  }

  container.innerHTML = events.map(ev => {
    const icon = ev.type === 'birthday' ? '&#127874;' : '&#10084;'
    const daysClass = ev.daysAway === 0 ? 'today' : ev.daysAway <= 2 ? 'soon' : ''
    const daysText = ev.daysAway === 0 ? 'Today!' : ev.daysAway === 1 ? 'Tomorrow' : `${ev.daysAway}d`
    return `
      <div class="event-item">
        <div class="event-icon ${ev.type}">${icon}</div>
        <div class="event-info">
          <div class="event-name">${ev.name}</div>
          <div class="event-detail">${ev.type === 'birthday' ? 'Birthday' : 'Anniversary'} &middot; ${ev.detail}</div>
        </div>
        <div class="event-days ${daysClass}">${daysText}</div>
      </div>`
  }).join('')
}

// =============================================
// CALENDAR VIEW
// =============================================
function renderCalendarView() {
  document.getElementById('cal-label').textContent = `${MONTHS[viewMonth]} ${viewYear}`

  const events = getCalendarEvents(viewYear, viewMonth)
  const now = new Date()
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  let html = DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('')
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>'

  for (let d = 1; d <= daysInMonth; d++) {
    const dayEvents = events[d] || []
    const hasBirthday = dayEvents.some(e => e.type === 'birthday')
    const hasAnniversary = dayEvents.some(e => e.type === 'anniversary')
    const isToday = d === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear()

    let cls = 'cal-day'
    if (hasBirthday && hasAnniversary) cls += ' has-event both'
    else if (hasBirthday) cls += ' has-event birthday'
    else if (hasAnniversary) cls += ' has-event anniversary'
    if (isToday) cls += ' today'

    const tooltip = dayEvents.length > 0
      ? `<div class="cal-tooltip">${dayEvents.map(e =>
          `<div>${e.type === 'birthday' ? '&#127874;' : '&#10084;'} ${e.name}</div>`
        ).join('')}</div>`
      : ''

    html += `<div class="${cls}"><span class="cal-day-num">${d}</span>${tooltip}</div>`
  }

  document.getElementById('calendar-grid').innerHTML = html
}

// =============================================
// SETTINGS
// =============================================
function applySettings(s) {
  const app = document.getElementById('app')
  app.className = `theme-${s.theme || 'dark'}`
  app.style.fontSize = `${s.fontSize || 14}px`
  app.style.fontFamily = s.fontFamily || 'Segoe UI, sans-serif'
  app.style.background = s.bgColor || undefined
  document.getElementById('settings-panel').style.background = s.bgColor || undefined

  if (s.view === 'list') switchView('list')
  else switchView('calendar')

  // Sync settings UI
  document.getElementById('s-font-size').value = s.fontSize || 14
  document.getElementById('s-font-family').value = s.fontFamily || 'Segoe UI, sans-serif'
  document.getElementById('s-bg-color').value = s.bgColor || '#2d2d2d'
  document.getElementById('s-opacity').value = s.opacity || 0.92
  document.getElementById('s-theme').value = s.theme || 'dark'
}

function setupSettingsUI() {
  document.getElementById('btn-settings').onclick = () => {
    document.getElementById('settings-panel').classList.remove('hidden')
  }

  document.getElementById('btn-settings-close').onclick = async () => {
    const newSettings = {
      fontSize: parseInt(document.getElementById('s-font-size').value),
      fontFamily: document.getElementById('s-font-family').value,
      bgColor: document.getElementById('s-bg-color').value,
      opacity: parseFloat(document.getElementById('s-opacity').value),
      theme: document.getElementById('s-theme').value,
    }
    await window.electronAPI.saveSettings(newSettings)
    document.getElementById('settings-panel').classList.add('hidden')
  }
}

// =============================================
// VIEW SWITCHING
// =============================================
function switchView(view) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))

  if (view === 'list') {
    document.getElementById('tab-list').classList.add('active')
    document.getElementById('view-list').classList.add('active')
  } else {
    document.getElementById('tab-calendar').classList.add('active')
    document.getElementById('view-calendar').classList.add('active')
  }
}

function setupTabs() {
  document.getElementById('tab-list').onclick = () => {
    switchView('list')
    window.electronAPI.saveSettings({ view: 'list' })
  }
  document.getElementById('tab-calendar').onclick = () => {
    switchView('calendar')
    window.electronAPI.saveSettings({ view: 'calendar' })
  }
}

// =============================================
// CALENDAR NAV
// =============================================
function setupCalendarNav() {
  document.getElementById('cal-prev').onclick = () => {
    if (viewMonth === 0) { viewMonth = 11; viewYear-- }
    else viewMonth--
    renderCalendarView()
  }

  document.getElementById('cal-next').onclick = () => {
    if (viewMonth === 11) { viewMonth = 0; viewYear++ }
    else viewMonth++
    renderCalendarView()
  }
}

// =============================================
// TITLE BAR
// =============================================
function setupTitleBar() {
  document.getElementById('btn-refresh').onclick = fetchMembers
  document.getElementById('btn-close').onclick = () => window.close()
}

// =============================================
// RESIZE
// =============================================
function setupResize() {
  const handle = document.getElementById('resize-handle')
  let resizing = false

  handle.onmousedown = (e) => {
    resizing = true
    const startX = e.clientX
    const startY = e.clientY
    const startW = window.innerWidth
    const startH = window.innerHeight

    document.onmousemove = (ev) => {
      if (!resizing) return
      const newW = Math.max(240, startW + (ev.clientX - startX))
      const newH = Math.max(200, startH + (ev.clientY - startY))
      window.resizeTo(newW, newH)
    }

    document.onmouseup = () => {
      resizing = false
      document.onmousemove = null
      document.onmouseup = null
      window.electronAPI.saveSettings({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    e.preventDefault()
  }
}

// =============================================
// START
// =============================================
document.addEventListener('DOMContentLoaded', init)
