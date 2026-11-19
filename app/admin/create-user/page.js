'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useUser } from '@/components/UserProvider'
import { UsersIcon, ArrowLeftIcon, SaveIcon, TrashIcon, CheckIcon } from '@/components/Icons'

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function CreateUserPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [createdUser, setCreatedUser] = useState(null)
  const [inviteUrl, setInviteUrl] = useState(null)
  const [emailError, setEmailError] = useState(null)
  const [copied, setCopied] = useState(false)

  const [resetEmail, setResetEmail] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState(null)
  const [resetFallbackUrl, setResetFallbackUrl] = useState(null)
  const [resetError, setResetError] = useState(null)

  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testError, setTestError] = useState(null)

  const [deleteEmail, setDeleteEmail] = useState('')
  const [deletingUser, setDeletingUser] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const [admins, setAdmins] = useState([])
  const [adminsLoading, setAdminsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function syncUser() {
      if (userLoading) return
      if (!user) { router.push('/login'); return }
      // Defer to a microtask so this doesn't synchronously cascade into another
      // render while the provider is still settling its own state.
      await Promise.resolve()
      if (cancelled) return
      setTestEmail(user.email || '')
    }
    syncUser()
    return () => { cancelled = true }
  }, [user, userLoading, router])

  useEffect(() => {
    fetch('/api/admin/list-users')
      .then(r => r.json())
      .then(data => { if (data.admins) setAdmins(data.admins) })
      .finally(() => setAdminsLoading(false))
  }, [])

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be blocked; the URL is visible to copy by hand.
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)
    setCreatedUser(null)
    setInviteUrl(null)
    setEmailError(null)
    setCopied(false)

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
      setInviteUrl(data.email_sent ? null : data.invite_url || null)
      setEmailError(data.email_sent ? null : data.email_error || null)
      setFirstName('')
      setLastName('')
      setEmail('')

      const refreshed = await fetch('/api/admin/list-users').then(r => r.json()).catch(() => null)
      if (refreshed?.admins) setAdmins(refreshed.admins)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setResetError(null)
    setResetMessage(null)
    setResetFallbackUrl(null)

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

      if (!res.ok) {
        // The API hands back a working link when delivery fails, so the admin
        // can still pass it along.
        if (data.reset_url) setResetFallbackUrl(data.reset_url)
        throw new Error(data.error)
      }

      setResetMessage(data.message)
    } catch (err) {
      setResetError(err.message)
    }
    setResetting(false)
  }

  async function handleTestEmail(e) {
    e.preventDefault()
    setTestError(null)
    setTestResult(null)
    if (!testEmail) {
      setTestError('Please enter an email address')
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTestResult(data.message)
    } catch (err) {
      setTestError(err.message)
    }
    setTesting(false)
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
              {emailError && (
                <div style={{ marginTop: '8px', fontSize: '0.8rem' }}>
                  {emailError}
                </div>
              )}
              {inviteUrl && (
                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <strong>Invitation link:</strong> share this with the user. It expires in 48 hours.
                  </div>
                  <code style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {inviteUrl}
                  </code>
                  <div style={{ marginTop: '8px' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => copyLink(inviteUrl)}>
                      {copied ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
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
                    <span className="form-hint">
                      The user receives an invitation link. Opening it verifies this address
                      and lets them choose their own password.
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
                  >
                    <UsersIcon size={18} />
                    {submitting ? 'Sending invitation…' : 'Create & Invite'}
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
                {resetMessage && (
                  <div className="settings-alert success" style={{ marginBottom: '12px' }}>
                    {resetMessage}
                  </div>
                )}
                {resetError && (
                  <div className="settings-alert error" style={{ marginBottom: '16px' }}>
                    {resetError}
                  </div>
                )}
                {resetFallbackUrl && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      <strong>Reset link:</strong> share this with the user. It expires in 1 hour and works once.
                    </div>
                    <code style={{ fontSize: '0.78rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {resetFallbackUrl}
                    </code>
                    <div style={{ marginTop: '8px' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => copyLink(resetFallbackUrl)}>
                        {copied ? 'Copied' : 'Copy link'}
                      </button>
                    </div>
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
                    <span className="form-hint">
                      A single-use link is emailed to this address. Sessions stay signed in
                      until the link is used.
                    </span>
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

            {/* Test Email Section */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title" style={{ margin: 0 }}>Test Email</h2>
              </div>
              <div className="card-body">
                {testResult && (
                  <div className="settings-alert success" style={{ marginBottom: '12px' }}>{testResult}</div>
                )}
                {testError && (
                  <div className="settings-alert error" style={{ marginBottom: '12px' }}>{testError}</div>
                )}
                <form onSubmit={handleTestEmail}>
                  <div className="form-group">
                    <label className="form-label">Send To</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="you@example.com"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      required
                    />
                    <span className="form-hint">
                      Confirms the Gmail API setup before you invite anyone.
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-ghost"
                    disabled={testing}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}
                  >
                    {testing ? 'Sending…' : 'Send Test Email'}
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
                                {a.email_verified_at ? (
                                  <span
                                    className="badge badge-active"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                    title={`Email verified ${formatDate(a.email_verified_at)}`}
                                  >
                                    <CheckIcon size={12} /> Verified
                                  </span>
                                ) : a.invited_at ? (
                                  <span className="badge badge-new" title={`Invited ${formatDate(a.invited_at)}`}>
                                    Invite pending
                                  </span>
                                ) : (
                                  <span className="badge badge-dormant" title="Set up outside the invitation flow">
                                    Active
                                  </span>
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