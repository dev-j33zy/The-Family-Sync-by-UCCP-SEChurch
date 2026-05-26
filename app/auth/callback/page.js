'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { HomeIcon } from '@/components/Icons'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return 'exchanging'
    const p = new URLSearchParams(window.location.search)
    const type = p.get('type')
    const tokenHash = p.get('token_hash')
    const code = p.get('code')
    if ((type === 'recovery' || type === 'signup') && tokenHash) return 'exchanging'
    return code ? 'exchanging' : 'error'
  })
  const [mode] = useState(() => {
    if (typeof window === 'undefined') return 'invite'
    const type = new URLSearchParams(window.location.search).get('type')
    if (type === 'recovery') return 'recovery'
    if (type === 'signup') return 'signup'
    return 'invite'
  })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => {
    if (typeof window === 'undefined') return ''
    const p = new URLSearchParams(window.location.search)
    const type = p.get('type')
    if ((type === 'recovery' || type === 'signup') && p.get('token_hash')) return ''
    if (p.get('code')) return ''
    return 'Invalid invitation link'
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const type = params.get('type')
    const tokenHash = params.get('token_hash')

    // Direct link (token_hash from admin.generateLink)
    if ((type === 'recovery' || type === 'signup') && tokenHash) {
      const otpType = type === 'recovery' ? 'recovery' : 'signup'
      supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash }).then(({ error: err }) => {
        if (err) { setError(err.message); setStep('error') }
        else setStep('set-password')
      })
      return
    }

    // No code and no recovery — handled by initial state
    if (!code) return

    // PKCE flow (from invite or Supabase email redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setStep('set-password')
      if (event === 'PASSWORD_RECOVERY') setStep('set-password')
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setStep('set-password')
    })

    return () => subscription?.unsubscribe()
  }, [supabase])

  async function handleSetPassword(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card animate-fade-in-up">
        <div className="login-logo"><HomeIcon size={24} /></div>
        <h1 className="login-title">The Family Sync</h1>

        {step === 'exchanging' && (
          <p className="login-subtitle">Completing your request…</p>
        )}

        {step === 'set-password' && (
          <>
            <p className="login-subtitle">
              {mode === 'recovery' ? 'Enter your new password' : 'Set your admin password to get started'}
            </p>
            {error && <div className="login-error">{error}</div>}
            <form className="login-form" onSubmit={handleSetPassword}>
              <div className="form-group">
                <label className="form-label" htmlFor="set-password">Password</label>
                <input
                  id="set-password"
                  type="password"
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="set-password-confirm">Confirm Password</label>
                <input
                  id="set-password-confirm"
                  type="password"
                  className="form-input"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ marginTop: '8px' }}
              >
                {loading ? 'Setting password…' : 'Set Password & Sign In'}
              </button>
            </form>
          </>
        )}

        {step === 'error' && (
          <>
            <div className="login-error" style={{ marginTop: '16px' }}>{error}</div>
            <p style={{ textAlign: 'center', marginTop: '16px' }}>
              <a href="/login" style={{ color: 'var(--primary)' }}>Back to Sign In</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
