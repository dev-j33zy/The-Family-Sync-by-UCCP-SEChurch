'use client'
import { useState, useEffect } from 'react'
import { getCalendarEvents, getUpcomingEvents, MONTHS, DAYS_OF_WEEK } from '@/lib/utils'
import { UsersIcon, CheckIcon, StarIcon, MoonIcon, CalendarIcon, BellIcon, HeartIcon, BalloonIcon, PartyIcon } from '@/components/Icons'

// =============================================
// STATS CARDS
// =============================================
export function StatsCards({ stats }) {
  const cards = [
    {
      key: 'total',
      label: 'Total Members',
      icon: UsersIcon,
      value: stats.total,
      cardClass: 'stat-card-total',
      iconClass: 'stat-icon-total',
      numClass: 'stat-number-total',
    },
    {
      key: 'active',
      label: 'Active Members',
      icon: CheckIcon,
      value: stats.active,
      cardClass: 'stat-card-active',
      iconClass: 'stat-icon-active',
      numClass: 'stat-number-active',
    },
    {
      key: 'new',
      label: 'New Members',
      icon: StarIcon,
      value: stats.new,
      cardClass: 'stat-card-new',
      iconClass: 'stat-icon-new',
      numClass: 'stat-number-new',
    },
    {
      key: 'dormant',
      label: 'Dormant',
      icon: MoonIcon,
      value: stats.dormant,
      cardClass: 'stat-card-dormant',
      iconClass: 'stat-icon-dormant',
      numClass: 'stat-number-dormant',
    },
  ]

  return (
    <div className="stats-grid stagger-children">
      {cards.map(card => (
        <div key={card.key} className={`stat-card ${card.cardClass}`}>
          <div className={`stat-icon ${card.iconClass}`}>{card.icon ? <card.icon size={22} /> : null}</div>
          <div className={`stat-number ${card.numClass}`}>{card.value}</div>
          <div className="stat-label">{card.label}</div>
        </div>
      ))}
    </div>
  )
}

// =============================================
// BIRTHDAY CALENDAR
// =============================================
export function BirthdayCalendar({ members }) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [hoveredDay, setHoveredDay] = useState(null)

  const events = getCalendarEvents(members, viewYear, viewMonth)

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const isToday = (day) =>
    day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const hoveredDayEvents = hoveredDay ? (events[hoveredDay] || []) : []

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title"><CalendarIcon size={18} /> Birthday & Anniversary Calendar</h2>
        <div className="calendar-nav">
          <button className="calendar-nav-btn" onClick={prevMonth}>‹</button>
          <span className="calendar-month-label">{MONTHS[viewMonth]} {viewYear}</span>
          <button className="calendar-nav-btn" onClick={nextMonth}>›</button>
        </div>
      </div>
      <div className="card-body birthday-calendar-body">
        <div className="calendar-grid">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="calendar-day-header">{d}</div>
          ))}
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="calendar-day empty" />
            const dayEvents = events[day] || []
            const hasBirthday = dayEvents.some(e => e.type === 'birthday')
            const hasAnniversary = dayEvents.some(e => e.type === 'anniversary')
            const isHovered = hoveredDay === day && dayEvents.length > 0

            const dayCircleStyle = {}
            if (hasBirthday && hasAnniversary) {
              dayCircleStyle.border = '2px solid transparent'
              dayCircleStyle.background = 'linear-gradient(#050203, #050203) padding-box, linear-gradient(135deg, #3B82F6, #EF4444) border-box'
              dayCircleStyle.borderRadius = '50%'
              dayCircleStyle.width = '28px'
              dayCircleStyle.height = '28px'
              dayCircleStyle.display = 'flex'
              dayCircleStyle.alignItems = 'center'
              dayCircleStyle.justifyContent = 'center'
            } else if (hasBirthday) {
              dayCircleStyle.border = '2px solid #3B82F6'
              dayCircleStyle.borderRadius = '50%'
              dayCircleStyle.width = '28px'
              dayCircleStyle.height = '28px'
              dayCircleStyle.display = 'flex'
              dayCircleStyle.alignItems = 'center'
              dayCircleStyle.justifyContent = 'center'
            } else if (hasAnniversary) {
              dayCircleStyle.border = '2px solid #EF4444'
              dayCircleStyle.borderRadius = '50%'
              dayCircleStyle.width = '28px'
              dayCircleStyle.height = '28px'
              dayCircleStyle.display = 'flex'
              dayCircleStyle.alignItems = 'center'
              dayCircleStyle.justifyContent = 'center'
            }

            const hasEvent = hasBirthday || hasAnniversary

            return (
              <div
                key={day}
                className={`calendar-day${isToday(day) ? ' today' : ''}`}
                onMouseEnter={() => dayEvents.length > 0 && setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <span className={`calendar-day-num${hasEvent ? ' event' : ''}`} style={dayCircleStyle}>{day}</span>
                <div className="calendar-tooltip-desktop">
                  {isHovered && (
                    <div className="calendar-tooltip">
                      {dayEvents.map((ev, i) => (
                        <div key={i} style={{ marginBottom: i < dayEvents.length - 1 ? '4px' : 0 }}>
                          <span style={{ color: ev.type === 'birthday' ? '#3B82F6' : '#EF4444', marginRight: '4px' }}>
                            {ev.type === 'birthday' ? <BalloonIcon size={14} /> : <HeartIcon size={14} />}
                          </span>
                          {ev.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {hoveredDayEvents.length > 0 && (
          <div className="calendar-tooltip-mobile">
            <div className="calendar-tooltip">
              {hoveredDayEvents.map((ev, i) => (
                <div key={i} style={{ marginBottom: i < hoveredDayEvents.length - 1 ? '4px' : 0 }}>
                  <span style={{ color: ev.type === 'birthday' ? '#3B82F6' : '#EF4444', marginRight: '4px' }}>
                    {ev.type === 'birthday' ? <BalloonIcon size={14} /> : <HeartIcon size={14} />}
                  </span>
                  {ev.name} · {ev.type === 'birthday' ? 'Birthday' : 'Anniversary'}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="calendar-legend">
          <div className="legend-item">
            <BalloonIcon size={18} style={{ color: '#3B82F6' }} />
            <span>Birthday</span>
          </div>
          <div className="legend-item">
            <HeartIcon size={18} style={{ color: '#EF4444' }} />
            <span>Anniversary</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================
// UPCOMING REMINDERS
// =============================================
export function UpcomingReminders({ members }) {
  const events = getUpcomingEvents(members, 7)

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <h2 className="card-title"><BellIcon size={18} /> Upcoming This Week</h2>
        <span className="badge badge-new">{events.length}</span>
      </div>
      <div className="card-body" style={{ overflowY: 'auto', maxHeight: '500px' }}>
        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><PartyIcon size={40} /></div>
            <div className="empty-state-text">No birthdays or anniversaries in the next 7 days</div>
          </div>
        ) : (
          <div className="reminders-list">
            {events.map((ev, i) => {
              const daysClass =
                ev.daysAway === 0 ? 'reminder-days-today' :
                ev.daysAway <= 2 ? 'reminder-days-soon' :
                'reminder-days-normal'

              return (
                <a key={i} href={`/members/${ev.memberId}`} className="reminder-item" style={{ textDecoration: 'none' }}>
                  <div className={`reminder-icon ${ev.type === 'birthday' ? 'reminder-icon-birthday' : 'reminder-icon-anniversary'}`}>
                    {ev.type === 'birthday' ? <BalloonIcon size={18} /> : <HeartIcon size={18} />}
                  </div>
                  <div className="reminder-info">
                    <div className="reminder-name">{ev.name}</div>
                    <div className="reminder-detail">
                      {ev.type === 'birthday' ? `Birthday · ${ev.detail}` : `Anniversary · ${ev.detail}`}
                    </div>
                  </div>
                  <div className={`reminder-days ${daysClass}`}>
                    {ev.daysAway === 0 ? 'Today!' :
                     ev.daysAway === 1 ? 'Tomorrow' :
                     `${ev.daysAway}d`}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
