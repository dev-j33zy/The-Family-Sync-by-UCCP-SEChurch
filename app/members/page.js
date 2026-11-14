'use client'
import { useState, useEffect, useRef } from 'react'
import Sidebar from '@/components/Sidebar'
import { PlusIcon, SearchIcon, EyeIcon, EditIcon, TrashIcon, UsersIcon } from '@/components/Icons'
import { formatDate, capitalize } from '@/lib/utils'
import Link from 'next/link'

function getAvatarClass(gender) {
  if (gender === 'male') return 'table-avatar table-avatar-male'
  if (gender === 'female') return 'table-avatar table-avatar-female'
  return 'table-avatar table-avatar-other'
}

function getInitials(m) {
  return `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase()
}

export default function MembersPage() {
  const [members, setMembers] = useState([])
  const [familyGroups, setFamilyGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [familyGroupId, setFamilyGroupId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const searchTimeoutRef = useRef(null)

  async function loadMembers(query = '', groupId = '') {
    const params = new URLSearchParams()
    if (query) params.set('search', query)
    if (groupId) params.set('family_group_id', groupId)

    const res = await fetch(`/api/members${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setMembers(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      const groupsRes = await fetch('/api/family-groups')
      if (groupsRes.ok && !cancelled) setFamilyGroups(await groupsRes.json())
      await loadMembers()
      if (cancelled) return
      setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [])

  function handleSearchChange(e) {
    const val = e.target.value
    setSearch(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => loadMembers(val.trim(), familyGroupId), 300)
  }

  function handleFamilyGroupChange(e) {
    const val = e.target.value
    setFamilyGroupId(val)
    loadMembers(search.trim(), val)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/members/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
    setDeleting(false)
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title">Members</h1>
              <p className="page-subtitle">Manage all registered church members</p>
            </div>
            <Link href="/members/new" className="btn btn-primary page-action-btn">
              <PlusIcon size={16} /> Add Member
            </Link>
          </div>

          {/* Search + Filter Bar */}
          <div className="filter-bar">
            <div className="search-wrapper">
              <span className="search-icon"><SearchIcon size={16} /></span>
              <input
                id="member-search"
                className="form-input search-input"
                placeholder="Search by first or last name…"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <select id="filter-family-group" className="form-select filter-select filter-dropdown" value={familyGroupId}
              onChange={handleFamilyGroupChange}>
              <option value="">All Family Groups</option>
              {(familyGroups || []).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            {(search || familyGroupId) && (
              <button className="btn btn-ghost btn-sm" onClick={() => {
                setSearch('')
                setFamilyGroupId('')
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
                loadMembers('', '')
              }}>Clear</button>
            )}
          </div>

          {loading ? (
            <div className="card skeleton" style={{ height: '400px' }} />
          ) : members.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: '64px 20px' }}>
                <div className="empty-state-icon"><UsersIcon size={40} /></div>
                <div className="empty-state-text">No members found</div>
                {search && (
                  <Link href="/members/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
                    <PlusIcon size={16} /> Add Member
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="mobile-hide">Date of Birth</th>
                      <th className="mobile-hide">Relationship Status</th>
                      <th>Membership Status</th>
                      <th className="mobile-hide">Membership Type</th>
                      <th className="mobile-hide">Family Group</th>
                      <th className="mobile-hide">Spouse</th>
                      <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(member => (
                      <tr key={member.id}>
                        <td>
                          <Link href={`/members/${member.id}`} style={{ textDecoration: 'none' }}>
                            <div className="table-member-name">
                              {member.profile_picture ? (
                                <div className="table-avatar" style={{ background: 'none', border: '2px solid var(--border)', overflow: 'hidden', padding: 0 }}>
                                  <img src={member.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                </div>
                              ) : (
                                <div className={getAvatarClass(member.gender)}>{getInitials(member)}</div>
                              )}
                              <div>
                                <div className="member-name">
                                  {member.last_name}, {member.first_name} {member.middle_name ? member.middle_name[0] + '.' : ''}
                                </div>
                                {member.member_code && (
                                  <div className="member-name-family">{member.member_code}</div>
                                )}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="mobile-hide" style={{ color: 'var(--text-secondary)' }}>
                          {member.date_of_birth ? formatDate(member.date_of_birth) : '—'}
                        </td>
                        <td className="mobile-hide" style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {member.relationship_status || '—'}
                        </td>
                        <td>
                          <span className={`badge badge-${member.membership_status}`}>
                            {capitalize(member.membership_status || '')}
                          </span>
                        </td>
                        <td className="mobile-hide">
                          {member.membership_type ? (
                            <span className={`badge badge-${member.membership_type}`}>
                              {capitalize(member.membership_type)}
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="mobile-hide" style={{ color: 'var(--text-secondary)' }}>
                          {member.family_groups?.name || '—'}
                        </td>
                        <td className="mobile-hide" style={{ color: 'var(--text-secondary)' }}>
                          {member.spouse_name || '—'}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Link title="View" className="btn btn-ghost btn-icon btn-sm" href={`/members/${member.id}`}><EyeIcon size={16} /></Link>
                            <Link title="Edit" className="btn btn-ghost btn-icon btn-sm" href={`/members/${member.id}/edit`}><EditIcon size={16} /></Link>
                            <button
                              title="Delete"
                              className="btn btn-danger btn-icon btn-sm"
                              onClick={() => setDeleteTarget(member)}
                            ><TrashIcon size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Member</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Are you sure you want to delete{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {deleteTarget.first_name} {deleteTarget.last_name}
                </strong>?
                This will also remove all their family relationships. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : <><TrashIcon size={16} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}