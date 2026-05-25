'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { UsersIcon, ArrowLeftIcon, SaveIcon, TrashIcon } from '@/components/Icons'

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

  const [resetEmail, setResetEmail] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState(null)

  const [deleteEmail, setDeleteEmail] = useState('')
  const [deletingUser, setDeletingUser] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
    }
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)
    setCreatedUser(null)

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
      <Sidebar user={user} />
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
                  <span style={{ color: 'var(--text-muted)' }}>
                    An invitation email has been sent with instructions to set their password.
                  </span>
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
                    Recovery link generated. Share it with the user.
                  </div>
                )}
                {resetLink && (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Recovery link (share with user)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input className="form-input" value={resetLink} readOnly
                        onClick={e => e.target.select()}
                        style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                      />
                      <button type="button" className="btn btn-secondary" onClick={copyLink}
                        style={{ whiteSpace: 'nowrap', padding: '10px 14px', flexShrink: 0 }}
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <span className="form-hint">The link was also sent by email if available</span>
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
          </div>
        </div>
      </main>
    </div>
  )
}
