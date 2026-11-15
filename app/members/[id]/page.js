'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { calculateAge, formatDate, capitalize, getFullName, getRelationshipLabel, membershipDateToYear } from '@/lib/utils'
import { PlusIcon, EditIcon, TrashIcon, TreeIcon, FrownIcon } from '@/components/Icons'
import Link from 'next/link'

function DetailField({ label, value }) {
  return (
    <div className="detail-field">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value || '—'}</div>
    </div>
  )
}

function getCombinedAddress(member) {
  const parts = [member.street_address, member.village, member.barangay, member.city]
  return parts.filter(Boolean).join(', ') || null
}

function getRelatedName(rel) {
  if (rel.related_member) return getFullName(rel.related_member)
  if (rel.spouse_first_name || rel.spouse_last_name) {
    return `${rel.spouse_first_name || ''} ${rel.spouse_last_name || ''}`.trim()
  }
  return null
}

function RelCard({ rel }) {
  const name = getRelatedName(rel)
  if (!name) return null
  const m = rel.related_member
  const initials = `${name[0] || ''}${name.split(' ').pop()?.[0] || ''}`.toUpperCase()
  const avatarClass = m?.gender === 'male' ? 'table-avatar-male' : m?.gender === 'female' ? 'table-avatar-female' : 'table-avatar-other'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '8px' }}>
      <div className={`table-avatar ${avatarClass}`}>{initials}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{getRelationshipLabel(rel.relationship_type)}</div>
      </div>
      {rel.related_member_id && (
        <Link href={`/members/${rel.related_member_id}`} className="btn btn-ghost btn-sm">View</Link>
      )}
    </div>
  )
}

export default function MemberDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/members/${id}`, { cache: 'no-store' })
      if (res.ok) setMember(await res.json())
      setLoading(false)
    }
    load()
  }, [id])

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/members/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/members')
    else setDeleting(false)
  }

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-wrapper">
            <div className="card skeleton" style={{ height: '500px' }} />
          </div>
        </main>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-wrapper">
            <div className="empty-state" style={{ marginTop: '80px' }}>
              <div className="empty-state-icon"><FrownIcon size={40} /></div>
              <div className="empty-state-text">Member not found</div>
              <Link href="/members" className="btn btn-primary" style={{ marginTop: '16px' }}>Back to Members</Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase()
  const age = calculateAge(member.date_of_birth)
  const spouseRel = member.relationships_list?.find(r => r.relationship_type === 'spouse')
  const spouseName = spouseRel ? getRelatedName(spouseRel) : null
  const relationships = member.relationships_list || []

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header flex items-center justify-between">
            <Link href="/members" className="btn btn-ghost btn-sm">← Members</Link>
            <Link href="/members/new" className="btn btn-primary page-action-btn"><PlusIcon size={16} /> Add Member</Link>
          </div>

          <div className="member-detail-grid">
            {/* Main card */}
            <div className="card animate-fade-in-up">
              {/* Header */}
              <div className="member-detail-header">
                <div className="member-detail-avatar">
                  {member.profile_picture ? (
                    <img src={member.profile_picture} alt={getFullName(member)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    initials
                  )}
                </div>
                <div className="member-detail-info">
                  <div className="member-detail-name">{getFullName(member)}</div>
                  {member.member_code && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                      ID: {member.member_code}
                    </div>
                  )}
                  <div className="member-detail-meta">
                    {member.family_groups?.name && <span>{member.family_groups.name} · </span>}
                    {age} years old · {capitalize(member.gender)}
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className={`badge badge-${member.membership_status}`}>{capitalize(member.membership_status)}</span>
                    {member.membership_type && (
                      <span className={`badge badge-${member.membership_type}`}>{capitalize(member.membership_type)}</span>
                    )}
                    {member.relationship_status && (
                      <span className="badge badge-default">{capitalize(member.relationship_status)}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link href={`/members/${id}/edit`} className="btn btn-ghost btn-sm"><EditIcon size={16} /> Edit</Link>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(true)}><TrashIcon size={16} /> Delete</button>
                </div>
              </div>

              {/* Details grid */}
              <div className="detail-grid">
                <DetailField label="Family Group" value={member.family_groups?.name} />
                <DetailField label="Spouse" value={spouseName} />
                <DetailField label="Date of Birth" value={formatDate(member.date_of_birth)} />
                <DetailField label="Citizenship" value={member.citizenship} />
                <DetailField label="Relationship Status" value={capitalize(member.relationship_status)} />
                {member.relationship_status === 'married' && (
                  <DetailField label="Wedding Anniversary" value={formatDate(member.wedding_anniversary)} />
                )}
                <DetailField label="Communicant Class Graduate" value={member.communicant_class_graduate} />
                <DetailField label="Date of Membership" value={member.date_of_membership ? membershipDateToYear(member.date_of_membership) : null} />
                <DetailField label="Registered" value={member.registered_at ? formatDate(member.registered_at) : null} />
              </div>

              {/* Contact info */}
              {(member.phone_number || member.email_address || getCombinedAddress(member)) && (
                <div style={{ padding: '0 28px 28px' }}>
                  <div className="form-section-title" style={{ marginBottom: '16px' }}>Contact Information</div>
                  <div className="detail-grid" style={{ padding: 0 }}>
                    {member.phone_number && <DetailField label="Phone" value={member.phone_number} />}
                    {member.email_address && <DetailField label="Email" value={member.email_address} />}
                    {getCombinedAddress(member) && (
                      <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                        <div className="detail-label">Home Address</div>
                        <div className="detail-value">{getCombinedAddress(member)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Relationships panel */}
            <div className="card animate-fade-in-up" style={{ animationDelay: '60ms' }}>
              <div className="card-header">
                <h2 className="card-title"><TreeIcon size={18} /> Family Links</h2>
              </div>
              <div className="card-body">
                {relationships.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><TreeIcon size={40} /></div>
                    <div className="empty-state-text">No family relationships linked yet.</div>
                  </div>
                ) : (
                  relationships.map(rel => (
                    <RelCard key={rel.id} rel={rel} />
                  ))
                )}
                <Link href={`/family-tree?member=${id}`} className="btn btn-ghost w-full" style={{ marginTop: '12px', justifyContent: 'center' }}>
                  View Full Family Tree →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Member</h2>
              <button className="modal-close" onClick={() => setDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Delete <strong style={{ color: 'var(--text-primary)' }}>{getFullName(member)}</strong>?
                All family relationships will also be removed. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : <><TrashIcon size={16} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}