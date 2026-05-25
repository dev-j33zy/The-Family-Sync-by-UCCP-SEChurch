'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import MemberTable from '@/components/MemberTable'
import { PlusIcon, TrashIcon } from '@/components/Icons'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function MembersPage() {
  const supabase = createClient()
  const [user, setUser] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function loadMembers() {
    const res = await fetch('/api/members')
    if (res.ok) {
      const data = await res.json()
      setMembers(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      await loadMembers()
    }
    init()
  }, [])

  async function handleDelete(member) {
    setDeleteTarget(member)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/members/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
    setDeleting(false)
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title">Members</h1>
              <p className="page-subtitle">Manage all registered family members</p>
            </div>
            <Link href="/members/new" className="btn btn-primary" id="add-member-btn">
              <PlusIcon size={16} /> Add Member
            </Link>
          </div>

          {loading ? (
            <div className="card skeleton" style={{ height: '400px' }} />
          ) : (
            <MemberTable members={members} onDelete={handleDelete} />
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Member</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Are you sure you want to delete{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {deleteTarget.first_name} {deleteTarget.last_name}
                </strong>?
                This will also remove all their family relationships. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : <><TrashIcon size={16} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
