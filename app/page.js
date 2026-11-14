'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { StatsCards, BirthdayCalendar, UpcomingReminders } from '@/components/DashboardWidgets'
import { PlusIcon, UsersIcon, XIcon } from '@/components/Icons'
import { formatDate, capitalize } from '@/lib/utils'
import Link from 'next/link'

function getAvatarClass(gender) {
  if (gender === 'male') return 'table-avatar table-avatar-male'
  if (gender === 'female') return 'table-avatar table-avatar-female'
  return 'table-avatar table-avatar-other'
}

function getInitials(m) {
  return `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase()
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, active: 0, new: 0, dormant: 0, cancelled: 0 })
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setMembers(data.members)
      }
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()

  const statCards = [
    { key: 'total', label: 'Total Members', value: stats.total, cardClass: 'stat-card-total', iconClass: 'stat-icon-total', numClass: 'stat-number-total', color: 'var(--primary)', lightColor: 'var(--primary-light)' },
    { key: 'active', label: 'Active Members', value: stats.active, cardClass: 'stat-card-active', iconClass: 'stat-icon-active', numClass: 'stat-number-active', color: 'var(--green)', lightColor: 'var(--green-light)' },
    { key: 'new', label: 'New Members', value: stats.new, cardClass: 'stat-card-new', iconClass: 'stat-icon-new', numClass: 'stat-number-new', color: 'var(--secondary)', lightColor: 'var(--secondary-light)' },
    { key: 'dormant', label: 'Dormant', value: stats.dormant, cardClass: 'stat-card-dormant', iconClass: 'stat-icon-dormant', numClass: 'stat-number-dormant', color: 'var(--amber)', lightColor: 'var(--amber-light)' },
    { key: 'cancelled', label: 'Cancelled', value: stats.cancelled, cardClass: '', iconClass: '', numClass: '', color: 'var(--rose)', lightColor: 'var(--rose-light)' },
  ]

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          {/* Header */}
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">
                {formatDate(now.toISOString(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <Link href="/members/new" className="btn btn-primary page-action-btn">
              <PlusIcon size={16} /> Add Member
            </Link>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="stats-grid">
              {[1,2,3,4].map(i => <div key={i} className="stat-card skeleton" style={{ height: '120px' }} />)}
            </div>
          ) : (
            <div className="stats-grid stagger-children" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {statCards.map(card => (
                <div key={card.key} className={`stat-card ${card.cardClass}`} style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', borderRadius: '50%', opacity: 0.07, background: card.color, transform: 'translate(20px, -20px)' }} />
                  <div className={`stat-icon ${card.iconClass}`} style={card.iconClass ? {} : { background: card.lightColor, color: card.color }}>
                    <XIcon size={22} />
                  </div>
                  <div className={`stat-number ${card.numClass}`} style={card.numClass ? {} : { color: card.color }}>{card.value}</div>
                  <div className="stat-label">{card.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Dashboard grid */}
          <div className="dashboard-grid">
            <div>
              {loading ? (
                <div className="card skeleton" style={{ height: '480px' }} />
              ) : (
                <BirthdayCalendar members={members} />
              )}
            </div>
            <div>
              {loading ? (
                <div className="card skeleton" style={{ height: '480px' }} />
              ) : (
                <UpcomingReminders members={members} />
              )}
            </div>
          </div>

          {/* Members list */}
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <h2 className="card-title"><UsersIcon size={18} /> Members</h2>
              <Link href="/members" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            {members.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px 20px' }}>
                <div className="empty-state-icon"><UsersIcon size={40} /></div>
                <div className="empty-state-text">No members found</div>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="mobile-hide">Date of Birth</th>
                      <th className="mobile-hide">Relationship Status</th>
                      <th>Membership Status</th>
                      <th className="mobile-hide">Membership Type</th>
                      <th className="mobile-hide">Spouse</th>
                      <th className="mobile-hide">Family Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(member => (
                      <tr key={member.id}>
                        <td>
                          <Link href={`/members/${member.id}`} style={{ textDecoration: 'none' }}>
                            <div className="table-member-name">
                              <div className={getAvatarClass(member.gender)}>{getInitials(member)}</div>
                              <div>
                                <div className="member-name">
                                  {member.last_name}, {member.first_name} {member.middle_name ? member.middle_name[0] + '.' : ''}
                                </div>
                                {member.member_code && (
                                  <div className="member-name-family">{member.member_code}</div>
                                )}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="mobile-hide" style={{ color: 'var(--text-secondary)' }}>
                          {member.date_of_birth ? formatDate(member.date_of_birth) : '—'}
                        </td>
                        <td className="mobile-hide" style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {member.relationship_status || '—'}
                        </td>
                        <td>
                          <span className={`badge badge-${member.membership_status}`}>
                            {capitalize(member.membership_status || '')}
                          </span>
                        </td>
                        <td className="mobile-hide">
                          {member.membership_type ? (
                            <span className={`badge badge-${member.membership_type}`}>
                              {capitalize(member.membership_type)}
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="mobile-hide" style={{ color: 'var(--text-secondary)' }}>
                          {member.spouse_name || '—'}
                        </td>
                        <td className="mobile-hide" style={{ color: 'var(--text-secondary)' }}>
                          {member.family_groups?.name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}