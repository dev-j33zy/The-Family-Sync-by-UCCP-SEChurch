'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/components/UserProvider'
import { SMS_ENABLED } from '@/lib/features'
import {
  LayoutIcon,
  UsersIcon,
  MessageIcon,
  XIcon,
  MenuIcon,
  LogOutIcon,
} from '@/components/Icons'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutIcon, section: 'main' },
  { href: '/members', label: 'Members', icon: UsersIcon, section: 'main' },
]

// Kept out of navItems on purpose: SMS is docked at the bottom of the nav,
// directly above the admin-only entries.
const smsItem = { href: '/sms', label: 'SMS', icon: MessageIcon }

export default function Sidebar() {
  const { user, logout } = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    router.push('/login')
  }

  const userInitial = user?.email?.charAt(0)?.toUpperCase() || ''
  const userDisplayName = user?.display_name || user?.first_name || user?.email || ''
  const userRole = user?.role || 'Member'

  return (
    <>
      {/* Mobile Topbar */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="sidebar-logo-mark" style={{ width: '32px', height: '32px', fontSize: '0.75rem', marginBottom: 0 }}>SEC</div>
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
          <div className="sidebar-logo-mark">SEC</div>
          <div className="sidebar-brand">
            The Family <span>Sync</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>by UCCP Sukat</div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? ' active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <span className="nav-item-icon">{item.icon ? <item.icon size={18} /> : null}</span>
              {item.label}
            </Link>
          ))}

          {/* SMS: docked at the bottom, above the admin section */}
          {SMS_ENABLED && (
            <Link
              href={smsItem.href}
              className={`nav-item${pathname.startsWith(smsItem.href) ? ' active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <span className="nav-item-icon"><smsItem.icon size={18} /></span>
              {smsItem.label}
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <Link
            href="/settings"
            className="sidebar-user"
            onClick={() => setIsOpen(false)}
          >
            <div className="sidebar-avatar">{userInitial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userDisplayName}</div>
              <div className="sidebar-user-role">{userRole}</div>
            </div>
          </Link>
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