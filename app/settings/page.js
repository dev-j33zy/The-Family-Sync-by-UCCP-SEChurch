'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useTheme } from '@/components/ThemeProvider'
import { createClient } from '@/lib/supabase'
import { SaveIcon, SunIcon, MoonIcon } from '@/components/Icons'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { theme, devToolsVisible, toggleTheme, toggleDevTools, mounted } = useTheme()

  const [user, setUser] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      setEmail(user.email || '')
      setDisplayName(user.user_metadata?.display_name || '')
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const updates = {}

      if (displayName !== (user?.user_metadata?.display_name || '')) {
        updates.data = { display_name: displayName }
      }

      if (password) {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setSaving(false)
          return
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setSaving(false)
          return
        }
        updates.password = password
      }

      if (email !== user?.email) {
        updates.email = email
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates)
        if (error) throw error
      }

      setMessage('Settings saved successfully')
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>Settings</h1>
              <p className="page-subtitle">Manage your account and preferences</p>
            </div>
            <button
              type="submit"
              form="settings-form"
              className="btn btn-primary page-action-btn"
              disabled={saving}
            >
              <SaveIcon size={18} />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>

          {message && (
            <div className="settings-alert success">
              {message}
            </div>
          )}

          {error && (
            <div className="settings-alert error">
              {error}
            </div>
          )}

          <form id="settings-form" onSubmit={handleSave}>
            <div className="settings-grid">
              {/* Profile Section */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title" style={{ margin: 0 }}>Profile</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Display Name</label>
                    <input
                      className="form-input"
                      placeholder="Your display name"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                    />
                    <span className="form-hint">Shown in the sidebar</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                    <span className="form-hint">Changing email may require verification</span>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title" style={{ margin: 0 }}>Password</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Leave blank to keep current"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <input
                      className="form-input"
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Appearance Section */}
            <div className="card" style={{ marginTop: '24px' }}>
              <div className="card-header">
                <h2 className="card-title" style={{ margin: 0 }}>Appearance</h2>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Theme</label>
                  <div className="theme-toggle-group">
                    <button
                      type="button"
                      className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => { if (mounted) toggleTheme() }}
                    >
                      <MoonIcon size={18} />
                      Dark
                    </button>
                    <button
                      type="button"
                      className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => { if (mounted) toggleTheme() }}
                    >
                      <SunIcon size={18} />
                      Light
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Developer Section */}
            <div className="card" style={{ marginTop: '24px' }}>
              <div className="card-header">
                <h2 className="card-title" style={{ margin: 0 }}>Developer</h2>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <label className="form-label" style={{ margin: 0 }}>Next.js Dev Tools</label>
                      <span className="form-hint" style={{ display: 'block', marginTop: '2px' }}>Show the floating route indicator in development</span>
                    </div>
                    <button
                      type="button"
                      className={`btn ${devToolsVisible ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={toggleDevTools}
                      style={{ minWidth: '80px' }}
                    >
                      {devToolsVisible ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </form>
        </div>
      </main>
    </div>
  )
}
