'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { UsersIcon, ArrowLeftIcon, SaveIcon, TrashIcon, CheckIcon } from '@/components/Icons'

function isRecent(dateStr, days = 7) {
  if (!dateStr) return false
  const then = new Date(dateStr)
  const now = new Date()
  const diffMs = now - then
  return diffMs >= 0 && diffMs < days * 24 * 60 * 60 * 1000
}

export default function CreateUserPage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [createdUser, setCreatedUser] = useState(null)
  const [inviteLink, setInviteLink] = useState(null)
  const [inviteCopied, setInviteCopied] = useState(false)

  const [resetEmail, setResetEmail] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState(null)

  const [deleteEmail, setDeleteEmail] = useState('')
  const [deletingUser, setDeletingUser] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const [admins, setAdmins] = useState([])
  const [adminsLoading, setAdminsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
    }
    load()
  }, [])

  useEffect(() => {
    fetch('/api/admin/list-users')
      .then(r => r.json())
      .then(data => { if (data.admins) setAdmins(data.admins) })
      .finally(() => setAdminsLoading(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)
    setCreatedUser(null)
    setInviteLink(null)

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setMessage(data.message)
      setCreatedUser(data.user)
      setInviteLink(data.link)
      setFirstName('')
      setLastName('')
      setEmail('')
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  const [resetLink, setResetLink] = useState(null)
  const [copied, setCopied] = useState(false)

  async function handleResetPassword(e) {
    e.preventDefault()
    setResetError(null)
    setResetSent(false)
    setResetLink(null)

    if (!resetEmail) {
      setResetError('Please enter an email address')
      return
    }

    setResetting(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setResetSent(true)
      setResetLink(data.link)
    } catch (err) {
      setResetError(err.message)
    }
    setResetting(false)
  }

  async function copyLink() {
    if (resetLink) {
      await navigator.clipboard.writeText(resetLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function copyInviteLink() {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2000)
    }
  }

  async function handleDeleteUser(e) {
    e.preventDefault()
    setDeleteError(null)
    setDeleteMessage(null)
    if (!deleteEmail) {
      setDeleteError('Please enter an email address')
      return
    }
    setDeletingUser(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: deleteEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDeleteMessage(data.message)
      setDeleteEmail('')
    } catch (err) {
      setDeleteError(err.message)
    }
    setDeletingUser(false)
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header flex items-center justify-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="btn btn-ghost btn-icon" onClick={() => router.push('/settings')}>
                <ArrowLeftIcon size={20} />
              </button>
              <div>
                <h1 className="page-title" style={{ margin: 0 }}>Admin Tools</h1>
                <p className="page-subtitle">Create new administrators and manage account access</p>
              </div>
            </div>
          </div>

          {message && (
            <div className="settings-alert success">
              {message}
              {createdUser && (
                <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                  <strong>Email:</strong> {createdUser.email}<br />
                  <strong>Name:</strong> {createdUser.first_name} {createdUser.last_name}<br />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="settings-alert error">
              {error}
            </div>
          )}

          <div className="settings-grid">
            {/* Create User Section */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title" style={{ margin: 0 }}>Create Admin User</h2>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input
                      className="form-input"
                      placeholder="John"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input
                      className="form-input"
                      placeholder="Doe"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
                  >
                    <UsersIcon size={18} />
                    {submitting ? 'Sending Invitation…' : 'Send Invitation'}
                  </button>
                </form>
              </div>
            </div>

            {/* Reset Password Section */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title" style={{ margin: 0 }}>Reset Password</h2>
              </div>
              <div className="card-body">
                {resetSent && (
                  <div className="settings-alert success" style={{ marginBottom: '12px' }}>
                    Recovery link sent via email successfully.
                  </div>
                )}
                {resetError && (
                  <div className="settings-alert error" style={{ marginBottom: '16px' }}>
                    {resetError}
                  </div>
                )}
                <form onSubmit={handleResetPassword}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="user@example.com"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      required
                    />
                    <span className="form-hint">A reset link will be sent to this email</span>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={resetting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
                  >
                    <SaveIcon size={18} />
                    {resetting ? 'Sending Reset Link…' : 'Send Reset Link'}
                  </button>
                </form>
              </div>
            </div>

            {/* Delete User Section */}
            <div className="card" style={{ borderColor: 'var(--danger)' }}>
              <div className="card-header">
                <h2 className="card-title" style={{ margin: 0, color: 'var(--danger)' }}>Delete User</h2>
              </div>
              <div className="card-body">
                {deleteMessage && (
                  <div className="settings-alert success" style={{ marginBottom: '12px' }}>{deleteMessage}</div>
                )}
                {deleteError && (
                  <div className="settings-alert error" style={{ marginBottom: '12px' }}>{deleteError}</div>
                )}
                <form onSubmit={handleDeleteUser}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="user@example.com"
                      value={deleteEmail}
                      onChange={e => setDeleteEmail(e.target.value)}
                      required
                    />
                    <span className="form-hint" style={{ color: 'var(--danger)' }}>
                      This permanently deletes the user account. Cannot be undone.
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={deletingUser}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
                  >
                    <TrashIcon size={18} />
                    {deletingUser ? 'Deleting User…' : 'Delete User'}
                  </button>
                </form>
              </div>
            </div>
            {/* Admin Users List */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title" style={{ margin: 0 }}>Admin Users</h2>
                <span className="form-hint">{admins.length} registered</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {adminsLoading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                ) : admins.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No admin users found.</div>
                ) : (
                  <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admins.map(a => (
                          <tr key={a.id}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{a.email}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span>{a.first_name || a.last_name ? `${a.first_name} ${a.last_name}`.trim() : '—'}</span>
                                {a.email_confirmed_at && (
                                  <span className="badge badge-active" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckIcon size={12} /> Verified
                                  </span>
                                )}
                                {isRecent(a.created_at) && (
                                  <span className="badge badge-new">New</span>
                                )}
                                {!a.email_confirmed_at && !isRecent(a.created_at) && (
                                  <span className="badge badge-dormant">Invited</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
