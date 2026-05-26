'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { StatsCards, BirthdayCalendar, UpcomingReminders } from '@/components/DashboardWidgets'
import { PlusIcon } from '@/components/Icons'
import { createClient } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const supabase = createClient()
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({ total: 0, active: 0, new: 0, dormant: 0, cancelled: 0 })
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const res = await fetch('/api/dashboard')
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
            <Link href="/members/new" className="btn btn-primary">
              <PlusIcon size={16} /> Add Member
            </Link>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="stats-grid">
              {[1,2,3,4].map(i => <div key={i} className="stat-card skeleton" style={{ height: '120px' }} />)}
            </div>
          ) : (
            <StatsCards stats={stats} />
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
        </div>
      </main>
    </div>
  )
}
