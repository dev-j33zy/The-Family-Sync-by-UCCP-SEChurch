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
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.substring(1))
    
    if (search.get('error') || hash.get('error')) return 'error'
    if (search.get('code')) return 'exchanging'
    if (search.get('token_hash')) return 'exchanging'
    if (hash.get('access_token')) return 'exchanging'
    
    return 'error'
  })

  const [mode] = useState(() => {
    if (typeof window === 'undefined') return 'invite'
    const search = new URLSearchParams(window.location.search)
    const type = search.get('type')
    if (type === 'recovery') return 'recovery'
    if (type === 'signup') return 'signup'
    return 'invite'
  })
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => {
    if (typeof window === 'undefined') return ''
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.substring(1))
    
    const err = search.get('error') || hash.get('error')
    const errDesc = search.get('error_description') || hash.get('error_description')
    
    if (err) return errDesc ? decodeURIComponent(errDesc.replace(/\+/g, ' ')) : 'Invalid invitation link'
    
    if (search.get('code') || search.get('token_hash') || hash.get('access_token')) return ''
    
    return 'Invalid invitation link'
  })

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.substring(1))
    
    const code = search.get('code')
    const type = search.get('type')
    const tokenHash = search.get('token_hash')
    const accessToken = hash.get('access_token')

    // Direct link with token_hash (from admin.generateLink)
    if (tokenHash) {
      const otpType = (type === 'recovery' || type === 'signup' || type === 'invite') ? type : 'invite'
      supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash }).then(({ error: err }) => {
        if (err) { setError(err.message); setStep('error') }
        else setStep('set-password')
      })
      return
    }

    // If there is an error in URL, don't do anything else
    if (search.get('error') || hash.get('error')) {
      setStep('error')
      return
    }

    // PKCE flow with code
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: err }) => {
        if (err) {
          // Detect the specific PKCE error that happens with Invite links
          if (err.message.includes('code verifier') || err.message.includes('grant')) {
            setError('Security mismatch (PKCE). The admin generated this invite, but you are opening it. Please ask the admin to update their Supabase Email Template to use token_hash as instructed.')
          } else {
            setError(err.message)
          }
          setStep('error')
        } else {
          setStep('set-password')
        }
      })
      return
    }

    // If neither code nor access_token is present and no token_hash, we can't do anything
    if (!accessToken) return

    // Implicit flow (access_token in hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        setStep('set-password')
      }
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
