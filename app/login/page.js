'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.push('/')
    } catch (err) {
      setError(err.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card animate-fade-in-up">
        <div className="login-logo">SEC</div>
        <h1 className="login-title">The Family Sync</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '8px', textAlign: 'center' }}>by UCCP Sukat</p>
        <p className="login-subtitle">Managed by the Membership Committee</p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="admin@familysync.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          New member?{' '}
          <Link href="/register" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Register here
          </Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Contact your administrator to create an account.
        </p>
      </div>
    </div>
  )
}