'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import MemberForm from '@/components/MemberForm'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function NewMemberPage() {
  const supabase = createClient()
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header">
            <div className="flex items-center gap-3 mb-4">
              <Link href="/members" className="btn btn-ghost btn-sm">← Back</Link>
            </div>
            <h1 className="page-title">Add New Member</h1>
            <p className="page-subtitle">Fill in the details below to register a new family member</p>
          </div>

          <div className="card">
            <div className="card-body">
              <MemberForm mode="create" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
