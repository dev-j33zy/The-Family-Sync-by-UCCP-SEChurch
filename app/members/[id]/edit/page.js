'use client'
import { useState, useEffect, use } from 'react'
import Sidebar from '@/components/Sidebar'
import MemberForm from '@/components/MemberForm'
import { createClient } from '@/lib/supabase'
import { getFullName } from '@/lib/utils'
import { FrownIcon } from '@/components/Icons'
import Link from 'next/link'

export default function EditMemberPage({ params }) {
  const { id } = use(params)
  const supabase = createClient()
  const [user, setUser] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const res = await fetch(`/api/members/${id}`)
      if (res.ok) setMember(await res.json())
      setLoading(false)
    }
    load()
  }, [id, supabase.auth])

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="flex items-center gap-3 mb-4">
            <Link href={`/members/${id}`} className="btn btn-ghost btn-sm">← Back to Profile</Link>
          </div>
          <div className="page-header">
            <h1 className="page-title">Edit Member</h1>
            {member && <p className="page-subtitle">{getFullName(member)}</p>}
          </div>

          {loading ? (
            <div className="card skeleton" style={{ height: '500px' }} />
          ) : member ? (
            <div className="card">
              <div className="card-body">
                <MemberForm member={member} mode="edit" />
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: '60px' }}>
              <div className="empty-state-icon"><FrownIcon size={40} /></div>
              <div className="empty-state-text">Member not found</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
