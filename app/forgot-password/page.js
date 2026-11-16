'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@/components/Icons'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send the reset link')
      setMessage(data.message)
      setEmail('')
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card animate-fade-in-up">
        <div className="login-logo">SEC</div>
        <h1 className="login-title">Forgot password</h1>
        <p className="login-subtitle">
          Enter your sign-in email and we will send you a link to set a new password.
        </p>

        {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}
        {message && (
          <div className="settings-alert success" style={{ marginBottom: '16px', fontSize: '0.8rem' }}>
            {message}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="forgot-email">Email Address</label>
            <input
              id="forgot-email"
              type="email"
              className="form-input"
              placeholder="admin@familysync.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem' }}>
          <Link
            href="/login"
            style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeftIcon size={14} /> Back to sign in
          </Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Members do not have accounts. Contact the Membership Committee if you need help
          with a member record.
        </p>
      </div>
    </div>
  )
}
