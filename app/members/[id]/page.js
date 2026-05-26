'use client'
import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { calculateAge, formatDate, capitalize, getStatusColor, getFullName, getRelationshipLabel, renderDatePickerHeader } from '@/lib/utils'
import { PlusIcon, EyeIcon, EditIcon, TrashIcon, TreeIcon, FrownIcon, CameraIcon } from '@/components/Icons'
import PhotoCropperModal from '@/components/PhotoCropper'
import Link from 'next/link'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

function parseDateString(str) {
  if (!str) return null
  const [y, m, d] = str.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
}

function toDateString(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function DetailField({ label, value }) {
  return (
    <div className="detail-field">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value || '—'}</div>
    </div>
  )
}

function RelCard({ rel, onRemove }) {
  const m = rel.related_member
  if (!m) return null
  const initials = `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase()
  const avatarClass = m.gender === 'male' ? 'table-avatar-male' : m.gender === 'female' ? 'table-avatar-female' : 'table-avatar-other'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '8px' }}>
      <div className={`table-avatar ${avatarClass}`}>{initials}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.first_name} {m.last_name}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{getRelationshipLabel(rel.relationship_type)}</div>
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <Link href={`/members/${m.id}`} className="btn btn-ghost btn-sm btn-icon" title="View"><EyeIcon size={16} /></Link>
        <button className="btn btn-danger btn-sm btn-icon" title="Remove" onClick={() => onRemove(rel.id)}>×</button>
      </div>
    </div>
  )
}

export default function MemberDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState(null)
  const [member, setMember] = useState(null)
  const [relationships, setRelationships] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Add relationship modal state
  const [addRelModal, setAddRelModal] = useState(false)
  const [allMembers, setAllMembers] = useState([])
  const [relType, setRelType] = useState('sibling')
  const [relTarget, setRelTarget] = useState('')
  const [addingRel, setAddingRel] = useState(false)

  // Spouse anniversary modal
  const [spouseAnniversaryModal, setSpouseAnniversaryModal] = useState(false)
  const [spouseAnniversaryDate, setSpouseAnniversaryDate] = useState('')
  const [spouseMemberId, setSpouseMemberId] = useState('')
  const [savingSpouse, setSavingSpouse] = useState(false)

  // Parent confirmation modal
  const [parentConfirmationModal, setParentConfirmationModal] = useState(false)
  const [parentAnniversaryDate, setParentAnniversaryDate] = useState('')
  const [parentFatherId, setParentFatherId] = useState('')
  const [parentMotherId, setParentMotherId] = useState('')
  const [savingParents, setSavingParents] = useState(false)

  // Photo modal
  const [photoModal, setPhotoModal] = useState(false)
  const [cropImage, setCropImage] = useState(null)
  const [deletingPhoto, setDeletingPhoto] = useState(false)
  const fileInputRef = useRef(null)

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPhotoModal(false)
      setCropImage(ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleCropDone(dataUrl) {
    setCropImage(null)
    await fetch(`/api/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_picture: dataUrl }),
    })
    const mRes = await fetch(`/api/members/${id}`)
    if (mRes.ok) setMember(await mRes.json())
  }

  async function handleDeletePhoto() {
    setDeletingPhoto(true)
    await fetch(`/api/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_picture: '' }),
    })
    const mRes = await fetch(`/api/members/${id}`)
    if (mRes.ok) setMember(await mRes.json())
    setDeletingPhoto(false)
    setPhotoModal(false)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const [mRes, rRes] = await Promise.all([
        fetch(`/api/members/${id}`),
        fetch(`/api/relationships?member_id=${id}`),
      ])
      if (mRes.ok) setMember(await mRes.json())
      if (rRes.ok) setRelationships(await rRes.json())
      setLoading(false)
    }
    load()
  }, [id, supabase.auth])

  async function openAddRel() {
    const res = await fetch('/api/members')
    if (res.ok) {
      const data = await res.json()
      setAllMembers(data.filter(m => m.id !== id))
    }
    setAddRelModal(true)
  }

  async function handleAddRel() {
    if (!relTarget) return
    setAddingRel(true)
    const res = await fetch('/api/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: id, related_member_id: relTarget, relationship_type: relType }),
    })
    if (res.ok) {
      const rRes = await fetch(`/api/relationships?member_id=${id}`)
      let rels = []
      if (rRes.ok) {
        rels = await rRes.json()
        setRelationships(rels)
      }

      if (relType === 'spouse') {
        setSpouseMemberId(relTarget)
        setRelTarget('')
        setAddRelModal(false)
        setSpouseAnniversaryModal(true)
        setAddingRel(false)
        return
      }

      if (relType === 'father' || relType === 'mother') {
        const fatherRel = rels.find(r => r.relationship_type === 'father')
        const motherRel = rels.find(r => r.relationship_type === 'mother')
        if (fatherRel && motherRel && fatherRel.related_member && motherRel.related_member) {
          const [fRes, mRes] = await Promise.all([
            fetch(`/api/members/${fatherRel.related_member.id}`),
            fetch(`/api/members/${motherRel.related_member.id}`),
          ])
          if (fRes.ok && mRes.ok) {
            const fData = await fRes.json()
            const mData = await mRes.json()
            if (fData.relationship_status !== 'married' || mData.relationship_status !== 'married') {
              setParentFatherId(fatherRel.related_member.id)
              setParentMotherId(motherRel.related_member.id)
              setParentConfirmationModal(true)
            }
          }
        }
      }

      setAddRelModal(false)
      setRelTarget('')
    }
    setAddingRel(false)
  }

  async function handleSaveSpouseAnniversary() {
    if (!spouseAnniversaryDate || !spouseMemberId) return
    setSavingSpouse(true)
    try {
      await Promise.all([
        fetch(`/api/members/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relationship_status: 'married', wedding_anniversary: spouseAnniversaryDate }),
        }),
        fetch(`/api/members/${spouseMemberId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relationship_status: 'married', wedding_anniversary: spouseAnniversaryDate }),
        }),
      ])
      setSpouseAnniversaryModal(false)
      setSpouseAnniversaryDate('')
      setSpouseMemberId('')
      const rRes = await fetch(`/api/relationships?member_id=${id}`)
      if (rRes.ok) setRelationships(await rRes.json())
    } catch (err) {
      console.error('Failed to update spouse:', err)
    }
    setSavingSpouse(false)
  }

  async function handleSaveParentAnniversary() {
    setSavingParents(true)
    try {
      const payload = { relationship_status: 'married' }
      if (parentAnniversaryDate) payload.wedding_anniversary = parentAnniversaryDate

      await Promise.all([
        fetch(`/api/members/${parentFatherId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch(`/api/members/${parentMotherId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ])

      const relRes = await fetch(`/api/relationships?member_id=${id}`)
      if (relRes.ok) {
        const rels = await relRes.json()
        const spouse = rels.find(r => r.relationship_type === 'spouse')
        const children = rels.filter(r => r.relationship_type === 'child').map(r => r.related_member?.id).filter(Boolean)
        const crossRelPromises = []

        if (spouse?.related_member?.id) {
          crossRelPromises.push(
            fetch('/api/relationships', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ member_id: spouse.related_member.id, related_member_id: parentFatherId, relationship_type: 'father' }),
            }).catch(() => {}),
            fetch('/api/relationships', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ member_id: spouse.related_member.id, related_member_id: parentMotherId, relationship_type: 'mother' }),
            }).catch(() => {})
          )
        }

        for (const childId of children) {
          crossRelPromises.push(
            fetch('/api/relationships', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ member_id: parentFatherId, related_member_id: childId, relationship_type: 'grandchild' }),
            }).catch(() => {}),
            fetch('/api/relationships', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ member_id: parentMotherId, related_member_id: childId, relationship_type: 'grandchild' }),
            }).catch(() => {})
          )
        }

        await Promise.all(crossRelPromises)
      }

      setParentConfirmationModal(false)
      setParentAnniversaryDate('')
      setParentFatherId('')
      setParentMotherId('')
      const rRes = await fetch(`/api/relationships?member_id=${id}`)
      if (rRes.ok) setRelationships(await rRes.json())
    } catch (err) {
      console.error('Failed to update parents:', err)
    }
    setSavingParents(false)
  }

  function handleSkipParentUpdate() {
    setParentConfirmationModal(false)
    setParentAnniversaryDate('')
    setParentFatherId('')
    setParentMotherId('')
  }

  async function handleRemoveRel(relId) {
    await fetch(`/api/relationships/${relId}`, { method: 'DELETE' })
    setRelationships(prev => prev.filter(r => r.id !== relId))
  }

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
                <div className="member-detail-avatar" style={{
                  ...(member.profile_picture ? { padding: 0, overflow: 'hidden' } : {}),
                  cursor: 'pointer'
                }} onClick={() => setPhotoModal(true)}>
                  {member.profile_picture ? (
                    <img src={member.profile_picture} alt={getFullName(member)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    initials
                  )}
                </div>
              <div className="member-detail-info">
                  <div className="member-detail-name">{getFullName(member)}</div>
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
                <DetailField label="Date of Birth" value={formatDate(member.date_of_birth)} />
                <DetailField label="Citizenship" value={member.citizenship} />
                <DetailField label="Relationship Status" value={capitalize(member.relationship_status)} />
                {member.relationship_status === 'married' && (
                  <DetailField label="Wedding Anniversary" value={formatDate(member.wedding_anniversary)} />
                )}
                <DetailField label="Communicant Class Graduate" value={member.communicant_class_graduate} />
                <DetailField label="Date of Membership" value={member.date_of_membership ? formatDate(member.date_of_membership) : null} />
                <DetailField label="Registered" value={member.registered_at ? formatDate(member.registered_at) : null} />
              </div>

              {/* Contact info */}
              {(member.phone_number || member.email_address || member.home_address) && (
                <div style={{ padding: '0 28px 28px' }}>
                  <div className="form-section-title" style={{ marginBottom: '16px' }}>Contact Information</div>
                  <div className="detail-grid" style={{ padding: 0 }}>
                    {member.phone_number && <DetailField label="Phone" value={member.phone_number} />}
                    {member.email_address && <DetailField label="Email" value={member.email_address} />}
                    {member.home_address && (
                      <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
                        <div className="detail-label">Home Address</div>
                        <div className="detail-value">{member.home_address}</div>
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
                <button className="btn btn-primary btn-sm" onClick={openAddRel} id="add-rel-btn">+ Link</button>
              </div>
              <div className="card-body">
                {relationships.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><TreeIcon size={40} /></div>
                    <div className="empty-state-text">No family relationships linked yet.</div>
                  </div>
                ) : (
                  relationships.map(rel => (
                    <RelCard key={rel.id} rel={rel} onRemove={handleRemoveRel} />
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

      {/* Add Relationship Modal */}
      {addRelModal && (
        <div className="modal-overlay" onClick={() => setAddRelModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Link Family Member</h2>
              <button className="modal-close" onClick={() => setAddRelModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Relationship Type</label>
                <select className="form-select" value={relType} onChange={e => setRelType(e.target.value)}>
                  <option value="spouse">Spouse</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="sibling">Sibling</option>
                  <option value="child">Child</option>
                  <option value="grandchild">Grandchild</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Select Member</label>
                <select className="form-select" value={relTarget} onChange={e => setRelTarget(e.target.value)}>
                  <option value="">Choose a member…</option>
                  {allMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.last_name}, {m.first_name} {m.middle_name || ''}
                      {m.family_groups?.name ? ` (${m.family_groups.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddRelModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddRel} disabled={!relTarget || addingRel}>
                {addingRel ? 'Linking…' : '+ Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spouse Anniversary Modal */}
      {spouseAnniversaryModal && (
        <div className="modal-overlay" onClick={() => setSpouseAnniversaryModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Set Wedding Anniversary</h2>
              <button className="modal-close" onClick={() => setSpouseAnniversaryModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                Set the wedding anniversary date to update both members&apos; relationship status to Married.
              </p>
              <div className="form-group">
                <label className="form-label">Wedding Anniversary</label>
                <DatePicker
                  selected={parseDateString(spouseAnniversaryDate)}
                  onChange={date => setSpouseAnniversaryDate(toDateString(date))}
                  className="form-input"
                  dateFormat="yyyy-MM-dd"
                  maxDate={new Date()}
                  renderCustomHeader={renderDatePickerHeader}
                  placeholderText="Select date"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSpouseAnniversaryModal(false)}>Skip</button>
              <button className="btn btn-primary" onClick={handleSaveSpouseAnniversary} disabled={!spouseAnniversaryDate || savingSpouse}>
                {savingSpouse ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent Confirmation Modal */}
      {parentConfirmationModal && (
        <div className="modal-overlay" onClick={handleSkipParentUpdate}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Update Parents</h2>
              <button className="modal-close" onClick={handleSkipParentUpdate}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                Both parents are now linked. Would you like to set their relationship status to Married?
              </p>
              <div className="form-group">
                <label className="form-label">Wedding Anniversary (optional)</label>
                <DatePicker
                  selected={parseDateString(parentAnniversaryDate)}
                  onChange={date => setParentAnniversaryDate(toDateString(date))}
                  className="form-input"
                  dateFormat="yyyy-MM-dd"
                  maxDate={new Date()}
                  renderCustomHeader={renderDatePickerHeader}
                  placeholderText="Select date"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={handleSkipParentUpdate}>Skip</button>
              <button className="btn btn-primary" onClick={handleSaveParentAnniversary} disabled={savingParents}>
                {savingParents ? 'Saving…' : 'Update as Married'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Expand Modal */}
      {photoModal && member.profile_picture && (
        <div className="modal-overlay" onClick={() => setPhotoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Profile Photo</h2>
              <button className="modal-close" onClick={() => setPhotoModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <img src={member.profile_picture} alt={getFullName(member)}
                style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} />
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', gap: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setPhotoModal(false); fileInputRef.current?.click() }}>
                <CameraIcon size={14} /> Replace
              </button>
              {member.profile_picture && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setPhotoModal(false); setCropImage(member.profile_picture) }}>
                  <CameraIcon size={14} /> Edit
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={handleDeletePhoto} disabled={deletingPhoto}>
                <TrashIcon size={14} /> {deletingPhoto ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropImage && (
        <PhotoCropperModal
          imageSrc={cropImage}
          onCrop={handleCropDone}
          onCancel={() => setCropImage(null)}
        />
      )}

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }}
        onChange={handleFileSelect} />
    </div>
  )
}
