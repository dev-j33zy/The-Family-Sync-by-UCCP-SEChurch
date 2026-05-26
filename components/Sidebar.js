'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/components/UserProvider'
import { LayoutIcon, UsersIcon, XIcon, MenuIcon, LogOutIcon } from '@/components/Icons'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutIcon, section: 'main' },
  { href: '/members', label: 'Members', icon: UsersIcon, section: 'main' },
]

export default function Sidebar() {
  const user = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [loggingOut, setLoggingOut] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || ''
  const userDisplayName = user?.user_metadata?.display_name || user?.email || ''

  return (
    <>
      {/* Mobile Topbar */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sidebar-logo-mark" style={{ width: '32px', height: '32px', fontSize: '1rem', marginBottom: 0 }}></div>
          <div>
            <div className="sidebar-brand">
              The Family <span>Sync</span>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '1px' }}>by UCCP Sukat</div>
          </div>
        </div>
        <button className="hamburger-btn" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && <div className="mobile-overlay" onClick={() => setIsOpen(false)} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo (Hidden on mobile) */}
        <div className="sidebar-logo desktop-only">
          <div className="sidebar-logo-mark"></div>
          <div className="sidebar-brand">
            The Family <span>Sync</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>by UCCP Sukat</div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(item => (
            <a
              key={item.href}
              href={item.href}
              className={`nav-item${pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? ' active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <span className="nav-item-icon">{item.icon ? <item.icon size={18} /> : null}</span>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user" style={{ cursor: 'pointer' }} onClick={() => router.push('/settings')}>
            <div className="sidebar-avatar">{userInitial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userDisplayName}</div>
              <div className="sidebar-user-role">Administrator</div>
            </div>
          </div>
          <button
            className="btn-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOutIcon size={18} />
            {loggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </aside>
    </>
  )
}
