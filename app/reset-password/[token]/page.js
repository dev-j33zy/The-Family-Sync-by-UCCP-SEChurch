'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy'

export default function ResetPasswordPage() {
  const router = useRouter()
  const params = useParams()
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token

  const [status, setStatus] = useState(token ? 'checking' : 'invalid') // checking | invalid | ready | saving
  const [details, setDetails] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    let cancelled = false
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (ok && data.valid) {
          setDetails(data)
          setStatus('ready')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid')
      })

    return () => { cancelled = true }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('The passwords do not match')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }

    setStatus('saving')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not set the password')

      // The route signs the account in, so land on the dashboard.
      router.replace('/')
      router.refresh()
    } catch (err) {
      setError(err.message)
      setStatus('ready')
    }
  }

  const isInvite = details?.purpose === 'invite'

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card animate-fade-in-up">
        <div className="login-logo">SEC</div>
        <h1 className="login-title">
          {status === 'invalid' ? 'Link not valid' : isInvite ? 'Welcome' : 'Set a new password'}
        </h1>

        {status === 'checking' && (
          <p className="login-subtitle">Checking this link…</p>
        )}

        {status === 'invalid' && (
          <>
            <p className="login-subtitle">
              This link is invalid, already used, or has expired. Reset links last 1 hour
              and invitations last 48 hours.
            </p>
            <Link
              href="/forgot-password"
              className="btn btn-primary btn-lg"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              Request a new link
            </Link>
            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem' }}>
              <Link href="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </>
        )}

        {(status === 'ready' || status === 'saving') && (
          <>
            <p className="login-subtitle">
              {isInvite
                ? 'Your account is ready. Choose a password to finish setting it up.'
                : 'Choose a new password for your account.'}
            </p>

            {details && (
              <div
                className="settings-alert success"
                style={{ marginBottom: '16px', fontSize: '0.8rem' }}
              >
                {details.name ? <strong>{details.name}</strong> : null}
                {details.name ? <br /> : null}
                {details.email}
              </div>
            )}

            {error && <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoFocus
                />
                <span className="form-hint">At least {MIN_PASSWORD_LENGTH} characters</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={status === 'saving'}
                style={{ marginTop: '8px' }}
              >
                {status === 'saving'
                  ? 'Saving…'
                  : isInvite ? 'Create my account' : 'Update password'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem' }}>
              <Link href="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
