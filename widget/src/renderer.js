(function () {
  'use strict'

  let settings = {}
  let events = []
  let auth = { signedIn: false, email: null }
  let lastFetchAt = 0
  let calMonth = new Date().getMonth()
  let calYear = new Date().getFullYear()

  const $ = (sel) => document.querySelector(sel)
  const $$ = (sel) => document.querySelectorAll(sel)

  /* =============================================
     TEXT COLOR ADAPTATION
     ============================================= */
  function getLuminance(hex) {
    const rgb = hexToRgb(hex)
    if (!rgb) return 0.5
    const [r, g, b] = rgb.map(c => {
      c /= 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  function hexToRgb(hex) {
    const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
    if (!m) return null
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
  }

  function rgbToStr(r, g, b, a) {
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
  }

  function autoTextColor(bgHex) {
    return getLuminance(bgHex) > 0.5 ? '#1a1a1a' : '#e0e0e0'
  }

  function lighten(hex, amount) {
    const rgb = hexToRgb(hex)
    if (!rgb) return hex
    const adjusted = rgb.map(c => {
      const val = c + Math.round((255 - c) * amount)
      return Math.min(255, Math.max(0, val))
    })
    return '#' + adjusted.map(c => c.toString(16).padStart(2, '0')).join('')
  }

  /* =============================================
     APPLY SETTINGS
     ============================================= */
  function applySettings(s) {
    settings = s

    const app = $('#app')

    // Theme class
    app.className = 'theme-' + (s.theme || 'dark')

    // Background color & opacity
    const bg = s.bgColor || '#2d2d2d'
    const bgRgb = hexToRgb(bg)
    const bgOp = s.bgOpacity !== undefined ? s.bgOpacity : 0.92
    if (bgRgb) {
      const bgWithOpacity = rgbToStr(bgRgb[0], bgRgb[1], bgRgb[2], bgOp)
      app.style.background = bgWithOpacity
      // Keep --bg fully opaque for child elements (dropdowns, list items, panels, etc.)
      app.style.setProperty('--bg', bg)
      // Compute --bg-secondary from the user's bg color for all themes
      const lum = getLuminance(bg)
      const bgSecondary = lum > 0.5 ? lighten(bg, -0.12) : lighten(bg, 0.18)
      app.style.setProperty('--bg-secondary', bgSecondary)
    }

    // Text color with text opacity
    const textColor = autoTextColor(bg)
    const textRgb = hexToRgb(textColor)
    const textOp = s.textOpacity !== undefined ? s.textOpacity : 1
    if (textRgb) {
      app.style.setProperty('--text', rgbToStr(textRgb[0], textRgb[1], textRgb[2], textOp))
    }

    // Font
    if (s.fontSize) app.style.setProperty('--font-size', s.fontSize + 'px')
    if (s.fontFamily) app.style.fontFamily = s.fontFamily

    // Update settings panel controls
    const syncUI = (id, val) => {
      const el = $(id)
      if (!el) return
      if (el.type === 'checkbox') el.checked = !!val
      else el.value = val
    }
    syncUI('#s-font-size', s.fontSize)
    syncUI('#s-font-family', s.fontFamily)
    syncUI('#s-bg-color', s.bgColor)
    syncUI('#s-bg-opacity', s.bgOpacity !== undefined ? s.bgOpacity : 0.92)
    syncUI('#s-text-opacity', s.textOpacity !== undefined ? s.textOpacity : 1)
    syncUI('#s-theme-input', s.theme)
    syncUI('#s-auto-start', s.autoStart)
    syncUI('#s-always-on-top', s.alwaysOnTop)
    syncUI('#s-start-in-tray', s.startInTray)
    const autoLabel = $('#s-auto-start-label')
    if (autoLabel) autoLabel.textContent = s.autoStart ? 'On' : 'Off'
    const ontopLabel = $('#s-always-on-top-label')
    if (ontopLabel) ontopLabel.textContent = s.alwaysOnTop ? 'On' : 'Off'
    const trayLabel = $('#s-start-in-tray-label')
    if (trayLabel) trayLabel.textContent = s.startInTray ? 'On' : 'Off'
  }

  /* =============================================
     HELPERS
     ============================================= */
  function fullName(m) {
    return [m.first_name, m.last_name].filter(Boolean).join(' ')
  }

  function escHtml(s) {
    const d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
  }

  function fmtDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  /* =============================================
     SVG ICONS (modern, inline)
     ============================================= */
  var SVGS = {
    birthday: '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="0.8"><path d="M3 7h10v7a1 1 0 01-1 1H4a1 1 0 01-1-1V7z"/><rect x="4" y="4" width="2" height="3" rx="0.5"/><rect x="7" y="3" width="2" height="4" rx="0.5"/><rect x="10" y="4" width="2" height="3" rx="0.5"/><rect x="2" y="7" width="12" height="1.5" rx="0.5"/></svg>',
    anniversary: '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="0.8"><path d="M8 14C2 9 0 6 0 4.5 0 2 2 0 4.5 0 6 0 7.5 1 8 2 8.5 1 10 0 11.5 0 14 0 16 2 16 4.5 16 6 14 9 8 14z"/></svg>',
    loading: '<svg viewBox="0 0 20 20" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="7" stroke-dasharray="30 14" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="0.8s" repeatCount="indefinite"/></circle></svg>',
    error: '<svg viewBox="0 0 18 18" width="18" height="18" fill="currentColor"><path d="M9 1a8 8 0 100 16A8 8 0 009 1zM8 5h2v5H8V5zm0 6h2v2H8v-2z"/></svg>',
    empty: '<svg viewBox="-3 -3 34 34" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"><g transform="rotate(12 14 14)"><path d="M14 4l11 23H3z"/><circle cx="14" cy="4" r="4" fill="currentColor" stroke="none"/><path d="M4 24c3 1.5 6 1.5 10 0s6 1.5 10 0"/></g></svg>',
    lock: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 118 0v3"/></svg>',
  }

  /* =============================================
     SIGN-IN STATE
     ============================================= */
  function errorText(err) {
    return String((err && err.message) || err || 'Unknown error')
      .replace(/^Error invoking remote method '[^']+':\s*/, '')
      .replace(/^Error:\s*/, '')
  }

  function updateAuthUI() {
    const item = $('#dropdown-login')
    if (!item) return
    item.innerHTML = auth.signedIn
      ? '&#128100; Sign out' + (auth.email ? ' (' + escHtml(auth.email) + ')' : '')
      : '&#128100; Sign in'
  }

  async function refreshAuth() {
    try {
      auth = await window.electronAPI.authStatus()
    } catch {
      auth = { signedIn: false, email: null }
    }
    updateAuthUI()
  }

  function showLogin() {
    if (!$('#settings-panel').classList.contains('hidden')) {
      $('#settings-panel').classList.add('hidden')
    }
    $$('.view').forEach(v => v.classList.remove('active'))
    $('#view-tabs').classList.add('hidden')
    $('#login-panel').classList.remove('hidden')

    const errEl = $('#login-error')
    if (errEl) {
      errEl.textContent = ''
      errEl.classList.add('hidden')
    }
    const pwd = $('#login-password')
    if (pwd) pwd.value = ''
    const email = $('#login-email')
    if (email) setTimeout(() => email.focus(), 0)
  }

  function hideLogin() {
    $('#login-panel').classList.add('hidden')
    $('#view-tabs').classList.remove('hidden')
    const activeTab = $('.tab.active')
    if (activeTab) {
      const view = document.getElementById('view-' + activeTab.dataset.view)
      if (view) view.classList.add('active')
    }
  }

  function renderSignedOut(message) {
    const markup =
      '<div class="empty-state"><div class="empty-state-icon">' + SVGS.lock + '</div>' +
      '<div>' + (message ? escHtml(message) : 'Sign in to see birthdays and anniversaries') + '</div>' +
      '<button type="button" class="btn-link btn-signin-inline">Sign in</button></div>'

    for (const sel of ['#events-list', '#calendar-grid']) {
      const el = $(sel)
      if (el) el.innerHTML = markup
    }
    $$('.btn-signin-inline').forEach(btn => btn.addEventListener('click', showLogin))
  }

  /* =============================================
     FETCH EVENTS (signed-in widget endpoint)
     ============================================= */
  async function fetchEvents() {
    lastFetchAt = Date.now()
    const container = $('#events-list')
    if (container && events.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">' + SVGS.loading + '</div><div>Loading...</div></div>'
    }

    try {
      const payload = await window.electronAPI.getEvents()

      if (payload && payload.unauthorized) {
        // Distinguish "never signed in" from "the stored session expired".
        const wasSignedIn = auth.signedIn
        events = []
        auth = { signedIn: false, email: null }
        updateAuthUI()
        renderSignedOut(wasSignedIn ? 'Your session expired. Sign in again.' : null)
        return
      }

      events = (payload && payload.members) || []

      buildList()
      if ($('#view-calendar').classList.contains('active')) buildCalendar()
    } catch (err) {
      console.error('Fetch error:', err)
      // Keep the last good data on a transient failure; the next poll retries.
      if (events.length > 0) return
      const container = $('#events-list')
      if (container) {
        container.innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">' + SVGS.error + '</div><div>Failed to load data</div>' +
          '<div style="font-size:10px;opacity:0.6;margin-top:4px">' + escHtml(errorText(err)) + '</div></div>'
      }
    }
  }

  /* =============================================
     REFRESH THROTTLE
     The web app is the source of truth, so poll it regularly and also
     refresh when the widget is reopened. Skip bursts of focus/show events.
     ============================================= */
  const FETCH_COOLDOWN_MS = 60 * 1000

  async function refreshEvents(force) {
    if (!force && Date.now() - lastFetchAt < FETCH_COOLDOWN_MS) return
    await fetchEvents()
  }

  /* =============================================
     BUILD LIST (upcoming events, sorted)
     ============================================= */
  function buildList() {
    const container = $('#events-list')
    if (!container) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcoming = []
    // Both spouses carry the same anniversary, so skip the couple's duplicate.
    const anniversariesSeen = new Set()

    for (const m of events) {
      const name = fullName(m)

      // Birthday
      if (m.date_of_birth) {
        const dob = new Date(m.date_of_birth + 'T00:00:00')
        const thisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
        if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
        const days = Math.round((thisYear - today) / (1000 * 60 * 60 * 24))
        upcoming.push({
          name: name,
          type: 'birthday',
          icon: SVGS.birthday,
          date: thisYear,
          days,
          // The age they turn on `thisYear` (on the day itself that is today's age).
          detail: 'Turns ' + (thisYear.getFullYear() - dob.getFullYear()),
        })
      }

      // Anniversary (only if married)
      if (m.wedding_anniversary && m.relationship_status === 'married') {
        const ann = new Date(m.wedding_anniversary + 'T00:00:00')
        const thisYear = new Date(today.getFullYear(), ann.getMonth(), ann.getDate())
        if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
        const days = Math.round((thisYear - today) / (1000 * 60 * 60 * 24))

        const spouseIds = m.spouse_ids || []
        const coupleKey = spouseIds.length
          ? [m.id, ...spouseIds].sort().join('|')
          : (m.spouse_name ? [name, m.spouse_name].sort().join('|') : null)
        if (coupleKey && anniversariesSeen.has(coupleKey)) continue
        if (coupleKey) anniversariesSeen.add(coupleKey)

        const years = today.getFullYear() - ann.getFullYear() + (thisYear.getFullYear() > today.getFullYear() ? 1 : 0)
        const displayName = m.spouse_name ? name + ' & ' + m.spouse_name : name
        upcoming.push({
          name: displayName,
          type: 'anniversary',
          icon: SVGS.anniversary,
          date: thisYear,
          days,
          detail: years + ' year' + (years !== 1 ? 's' : ''),
        })
      }
    }

    upcoming.sort((a, b) => a.days - b.days)

    // Only show this week's events
    const weekEvents = upcoming.filter(function (e) { return e.days <= 7 })

    if (weekEvents.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">' + SVGS.empty + '</div><div>No events this week</div></div>'
      return
    }

    let html = ''
    for (const item of weekEvents) {
      const daysLabel = item.days === 0 ? 'Today!' : (item.days === 1 ? 'Tomorrow' : item.days + 'd')
      const daysClass = item.days === 0 ? 'today' : (item.days <= 7 ? 'soon' : '')
      html +=
        '<div class="event-item">' +
          '<div class="event-icon ' + item.type + '">' + item.icon + '</div>' +
          '<div class="event-info">' +
            '<div class="event-name">' + escHtml(item.name) + '</div>' +
            '<div class="event-detail">' + escHtml(item.detail) + ' &#183; ' + escHtml(fmtDate(item.date)) + '</div>' +
          '</div>' +
          '<div class="event-days ' + daysClass + '">' + daysLabel + '</div>' +
        '</div>'
    }
    container.innerHTML = html
  }

  /* =============================================
     BUILD CALENDAR (array-per-day events, JS hover tooltip)
     ============================================= */
  function buildCalendar() {
    const grid = $('#calendar-grid')
    const label = $('#cal-label')
    const tooltipArea = $('#calendar-tooltip-area')
    if (!grid || !label) return

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    label.textContent = monthNames[calMonth] + ' ' + calYear

    const dayNames = ['S','M','T','W','T','F','S']
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const today = new Date()

    // Build array-per-day event structure (like web app's getCalendarEvents)
    const eventsByDay = {}
    for (const m of events) {
      const name = fullName(m)

      // Birthday
      if (m.date_of_birth) {
        const bd = new Date(m.date_of_birth + 'T00:00:00')
        if (bd.getMonth() === calMonth) {
          const day = bd.getDate()
          if (!eventsByDay[day]) eventsByDay[day] = []
          eventsByDay[day].push({ type: 'birthday', name })
        }
      }

      // Anniversary (only if married)
      if (m.wedding_anniversary && m.relationship_status === 'married') {
        const ann = new Date(m.wedding_anniversary + 'T00:00:00')
        if (ann.getMonth() === calMonth) {
          const day = ann.getDate()
          if (!eventsByDay[day]) eventsByDay[day] = []
          const displayName = m.spouse_name ? name + ' & ' + m.spouse_name : name
          // Deduplicate same-couple anniversaries by member ID
          const spouseIds = m.spouse_ids || []
          if (spouseIds.length > 0) {
            let alreadyAdded = false
            for (const existing of eventsByDay[day]) {
              if (existing.type === 'anniversary' && existing._memberIds) {
                if (existing._memberIds.has(m.id) || spouseIds.some(sid => existing._memberIds.has(sid))) {
                  alreadyAdded = true
                  break
                }
              }
            }
            if (!alreadyAdded) {
              const memberIds = new Set([m.id, ...spouseIds])
              eventsByDay[day].push({ type: 'anniversary', name: displayName, _memberIds: memberIds })
            }
          } else {
            eventsByDay[day].push({ type: 'anniversary', name: displayName })
          }
        }
      }
    }

    // Build grid HTML
    let html = dayNames.map(d => '<div class="cal-day-header">' + d + '</div>').join('')

    for (let i = 0; i < firstDay; i++) {
      html += '<div class="cal-day empty"></div>'
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayEvents = eventsByDay[d] || []
      const hasBirthday = dayEvents.some(e => e.type === 'birthday')
      const hasAnniversary = dayEvents.some(e => e.type === 'anniversary')
      const isToday = calYear === today.getFullYear() && calMonth === today.getMonth() && d === today.getDate()

      let classes = 'cal-day'
      if (isToday) classes += ' today'
      if (dayEvents.length > 0) classes += ' has-event'
      if (hasBirthday && hasAnniversary) classes += ' has-both'
      else if (hasBirthday) classes += ' has-birthday'
      else if (hasAnniversary) classes += ' has-anniversary'

      html +=
        '<div class="' + classes + '" data-day="' + d + '">' +
          '<span class="cal-day-num">' + d + '</span>' +
        '</div>'
    }

    grid.innerHTML = html

    // Wire up hover events for tooltip
    const dayEls = grid.querySelectorAll('.cal-day.has-event')
    for (const el of dayEls) {
      el.addEventListener('mouseenter', function () {
        const day = parseInt(this.dataset.day, 10)
        const dayEvents = eventsByDay[day] || []
        if (dayEvents.length === 0) return
        let tooltipHtml = ''
        for (const ev of dayEvents) {
          const icon = ev.type === 'birthday' ? SVGS.birthday : SVGS.anniversary
          const iconClass = ev.type === 'birthday' ? 'birthday' : 'anniversary'
          tooltipHtml +=
            '<div class="tt-event">' +
              '<span class="tt-icon ' + iconClass + '">' + icon + '</span>' +
              '<span>' + escHtml(ev.name) + '</span>' +
            '</div>'
        }
        if (tooltipArea) {
          tooltipArea.innerHTML = tooltipHtml
          tooltipArea.classList.remove('hidden')
        }
      })
      el.addEventListener('mouseleave', function () {
        if (tooltipArea) tooltipArea.classList.add('hidden')
      })
    }

    // Hide tooltip on leaving the grid entirely
    grid.addEventListener('mouseleave', function () {
      if (tooltipArea) tooltipArea.classList.add('hidden')
    })
  }

  /* =============================================
     SETTINGS PANEL — own page (hides views)
     ============================================= */
  function showSettings() {
    if (!$('#login-panel').classList.contains('hidden')) {
      $('#login-panel').classList.add('hidden')
    }
    $$('.view').forEach(v => v.classList.remove('active'))
    $('#view-tabs').classList.add('hidden')
    $('#settings-panel').classList.remove('hidden')
  }

  function hideSettings() {
    $('#settings-panel').classList.add('hidden')
    $('#view-tabs').classList.remove('hidden')
    const activeTab = $('.tab.active')
    if (activeTab) {
      const view = document.getElementById('view-' + activeTab.dataset.view)
      if (view) view.classList.add('active')
    }
  }

  function collectSettingsFromUI() {
    return {
      fontSize: parseInt($('#s-font-size').value, 10),
      fontFamily: $('#s-font-family').value,
      bgColor: $('#s-bg-color').value,
      bgOpacity: parseFloat($('#s-bg-opacity').value),
      textOpacity: parseFloat($('#s-text-opacity').value),
      theme: $('#s-theme-input').value,
      autoStart: $('#s-auto-start').checked,
      alwaysOnTop: $('#s-always-on-top').checked,
      startInTray: $('#s-start-in-tray').checked,
    }
  }

  /* =============================================
     DROPDOWN MENU
     ============================================= */
  function toggleMenu() {
    $('#dropdown-menu').classList.toggle('hidden')
  }

  function hideMenu() {
    $('#dropdown-menu').classList.add('hidden')
  }

  /* =============================================
     DRAG & RESIZE
     ============================================= */
  let isDragging = false, dragStartX, dragStartY, winStartX, winStartY
  let isResizing = false, resizeStartX, resizeStartY, resizeW, resizeH

  function initDrag() {
    const titlebar = $('#titlebar-drag')
    if (!titlebar) return

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('#titlebar-actions')) return
      isDragging = true
      dragStartX = e.screenX
      dragStartY = e.screenY
      winStartX = window.screenX
      winStartY = window.screenY
      e.preventDefault()
    })
  }

  function initResize() {
    const handle = $('#resize-handle')
    if (!handle) return

    handle.addEventListener('mousedown', (e) => {
      isResizing = true
      resizeStartX = e.screenX
      resizeStartY = e.screenY
      resizeW = window.innerWidth
      resizeH = window.innerHeight
      e.preventDefault()
      e.stopPropagation()
    })
  }

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.screenX - dragStartX
      const dy = e.screenY - dragStartY
      window.moveTo(winStartX + dx, winStartY + dy)
    }
    if (isResizing) {
      const dw = e.screenX - resizeStartX
      const dh = e.screenY - resizeStartY
      window.resizeTo(Math.max(250, resizeW + dw), Math.max(200, resizeH + dh))
    }
  })

  document.addEventListener('mouseup', () => {
    isDragging = false
    isResizing = false
  })

  /* =============================================
     UPDATE NOTIFICATION
     ============================================= */
  function showUpdateNotification(version, downloadUrl, assetName) {
    const notif = $('#update-notification')
    const verEl = $('#update-version')
    const installBtn = $('#update-install')
    const remindBtn = $('#update-remind')
    const errorEl = $('#update-error')
    if (!notif || !verEl || !installBtn || !remindBtn) return
    verEl.textContent = 'v' + version
    notif.classList.remove('hidden')
    installBtn.disabled = false
    remindBtn.disabled = false
    installBtn.textContent = 'Install'
    if (errorEl) {
      errorEl.textContent = ''
      errorEl.classList.add('hidden')
    }

    installBtn.onclick = async function () {
      installBtn.disabled = true
      remindBtn.disabled = true
      installBtn.textContent = 'Downloading...'
      if (errorEl) {
        errorEl.textContent = ''
        errorEl.classList.add('hidden')
      }
      try {
        const result = await window.electronAPI.downloadAndInstallUpdate(downloadUrl, assetName)
        // The widget hands off to the installer and quits; the setup then
        // reopens the app.
        installBtn.textContent = result ? 'Installing...' : 'Restarting...'
      } catch (err) {
        const message = String((err && err.message) || '')
          .replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        installBtn.disabled = false
        remindBtn.disabled = false
        installBtn.textContent = 'Install'
        if (errorEl) {
          errorEl.textContent = message || 'The update could not be installed.'
          errorEl.classList.remove('hidden')
        }
      }
    }
    remindBtn.onclick = function () {
      settings.updateSnooze = Date.now() + 86400000
      window.electronAPI.saveSettings({ updateSnooze: settings.updateSnooze })
      notif.classList.add('hidden')
    }
  }

  async function checkForUpdate() {
    if (settings.updateSnooze && Date.now() < settings.updateSnooze) return
    try {
      const result = await window.electronAPI.checkForUpdate()
      if (result && result.available && result.downloadUrl) {
        showUpdateNotification(result.version, result.downloadUrl, result.assetName)
      }
    } catch {}
  }

  /* =============================================
     INIT
     ============================================= */
  async function init() {
    try {
      settings = await window.electronAPI.getSettings()
    } catch {}
    if (!settings || !settings.theme) settings = {
      width: 340, height: 480, fontSize: 14,
      fontFamily: 'Segoe UI, sans-serif', bgColor: '#2d2d2d',
      bgOpacity: 0.92, textOpacity: 1, theme: 'dark',
      view: 'list', autoStart: false, alwaysOnTop: true, startInTray: false,
    }

    applySettings(settings)

    // Tab switching
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (!$('#settings-panel').classList.contains('hidden')) hideSettings()
        hideMenu()
        $$('.tab').forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        $$('.view').forEach(v => v.classList.remove('active'))
        const tooltipArea = $('#calendar-tooltip-area')
        if (tooltipArea) tooltipArea.classList.add('hidden')
        const view = document.getElementById('view-' + tab.dataset.view)
        if (view) {
          view.classList.add('active')
          if (tab.dataset.view === 'calendar') buildCalendar()
        }
        window.electronAPI.saveSettings({ view: tab.dataset.view })
      })
    })

    // Calendar nav
    $('#cal-prev').addEventListener('click', () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear-- } buildCalendar(); hideMenu() })
    $('#cal-next').addEventListener('click', () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++ } buildCalendar(); hideMenu() })

    // Dots menu
    $('#btn-dots').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu() })
    $('#dropdown-login').addEventListener('click', async () => {
      hideMenu()
      if (auth.signedIn) {
        try { await window.electronAPI.logout() } catch {}
        auth = { signedIn: false, email: null }
        updateAuthUI()
        await fetchEvents()
      } else {
        showLogin()
      }
    })
    $('#dropdown-settings').addEventListener('click', () => { hideMenu(); showSettings() })
    $('#dropdown-refresh').addEventListener('click', () => { hideMenu(); refreshEvents(true) })
    $('#dropdown-close').addEventListener('click', () => { hideMenu(); window.close() })

    // Sign-in panel
    $('#login-panel').addEventListener('submit', async (e) => {
      e.preventDefault()

      const errEl = $('#login-error')
      const submit = $('#btn-login-submit')
      const email = $('#login-email').value.trim()
      const password = $('#login-password').value

      errEl.textContent = ''
      errEl.classList.add('hidden')
      submit.disabled = true
      submit.textContent = 'Signing in...'

      try {
        await window.electronAPI.login({ email, password })
        await refreshAuth()
        hideLogin()
        await fetchEvents()
      } catch (err) {
        errEl.textContent = errorText(err)
        errEl.classList.remove('hidden')
      } finally {
        submit.disabled = false
        submit.textContent = 'Sign in'
      }
    })
    $('#btn-login-cancel').addEventListener('click', () => { hideLogin(); fetchEvents() })

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) hideMenu()
    })

    // Settings controls — all preview live on input
    $('#s-font-size').addEventListener('input', () => {
      applySettings(collectSettingsFromUI())
    })
    $('#s-bg-color').addEventListener('input', () => {
      applySettings(collectSettingsFromUI())
    })
    $('#s-bg-opacity').addEventListener('input', () => {
      applySettings(collectSettingsFromUI())
    })
    $('#s-text-opacity').addEventListener('input', () => {
      applySettings(collectSettingsFromUI())
    })
    $('#s-theme-input').addEventListener('input', () => {
      applySettings(collectSettingsFromUI())
    })
    $('#s-auto-start').addEventListener('input', () => {
      const s = collectSettingsFromUI()
      applySettings(s)
      window.electronAPI.saveSettings(s)
    })
    $('#s-always-on-top').addEventListener('input', () => {
      const s = collectSettingsFromUI()
      applySettings(s)
      window.electronAPI.saveSettings(s)
    })
    $('#s-start-in-tray').addEventListener('input', () => {
      const s = collectSettingsFromUI()
      applySettings(s)
      window.electronAPI.saveSettings(s)
    })

    // Font picker
    const fontInput = $('#s-font-family')
    const fontOptions = $('#s-font-options')
    fontInput.addEventListener('click', (e) => {
      e.stopPropagation()
      fontOptions.classList.toggle('hidden')
    })
    fontOptions.querySelectorAll('.font-option').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation()
        fontInput.value = this.dataset.value
        fontOptions.classList.add('hidden')
        applySettings(collectSettingsFromUI())
      })
    })
    document.addEventListener('click', () => {
      fontOptions.classList.add('hidden')
    })
    // Theme picker
    const themeInput = $('#s-theme-input')
    const themeOptions = $('#s-theme-options')
    themeInput.addEventListener('click', (e) => {
      e.stopPropagation()
      themeOptions.classList.toggle('hidden')
    })
    themeOptions.querySelectorAll('.font-option').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation()
        themeInput.value = this.dataset.value
        themeOptions.classList.add('hidden')
        applySettings(collectSettingsFromUI())
      })
    })
    document.addEventListener('click', () => {
      themeOptions.classList.add('hidden')
    })
    // Done: save everything and close
    $('#btn-settings-close').addEventListener('click', () => {
      const s = collectSettingsFromUI()
      applySettings(s)
      window.electronAPI.saveSettings(s)
      hideSettings()
    })

    // Listen for settings updates from main process
    if (window.electronAPI.onSettingsUpdated) {
      window.electronAPI.onSettingsUpdated((s) => applySettings(s))
    }

    // Refresh whenever the widget is reopened or focused
    if (window.electronAPI.onRefreshRequested) {
      window.electronAPI.onRefreshRequested(() => refreshEvents(false))
    }

    // Drag & Resize
    initDrag()
    initResize()

    // Fetch events (check the stored session first)
    await refreshAuth()
    refreshEvents(true)

    // Poll so members added in the web app show up while the widget is open
    setInterval(() => refreshEvents(false), 5 * 60 * 1000)

    // Check for updates (silent)
    checkForUpdate()
  }

  document.addEventListener('DOMContentLoaded', init)
})()