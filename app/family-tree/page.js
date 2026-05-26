'use client'
import { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { calculateAge, getFullName, getRelationshipLabel, capitalize, renderDatePickerHeader } from '@/lib/utils'
import { PlusIcon, TreeIcon } from '@/components/Icons'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
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

// ── Tree Member Card ───────────────────────────────────────────────────────────
function TreeCard({ member, isCenter = false, label, onClick, onRemove }) {
  if (!member) return null
  const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase()
  const genderColor = member.gender === 'male' ? 'var(--primary)' :
                      member.gender === 'female' ? 'var(--secondary)' : 'var(--amber)'
  const genderBg = member.gender === 'male' ? 'var(--primary-light)' :
                   member.gender === 'female' ? 'var(--secondary-light)' : 'var(--amber-light)'

  return (
    <div className="tree-member-card" onClick={() => onClick && onClick(member.id)}>
      {label && <div className="tree-label">{label}</div>}
      <div className={`tree-card-inner${isCenter ? ' center-card' : ''}`}>
        {onRemove && <button className="tree-remove-btn" onClick={e => { e.stopPropagation(); onRemove() }}>×</button>}
        <div className="tree-card-avatar"
          style={member.profile_picture ? { padding: 0, overflow: 'hidden', background: 'none' } : { background: isCenter ? `linear-gradient(135deg, var(--primary), var(--secondary))` : genderBg, color: isCenter ? 'white' : genderColor }}>
          {member.profile_picture ? (
            <img src={member.profile_picture} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : initials}
        </div>
        <div className="tree-card-name">{member.first_name}<br />{member.last_name}</div>
        {!isCenter && (
          <div className="tree-card-rel" style={{ marginTop: '4px' }}>
            {calculateAge(member.date_of_birth)} yrs
          </div>
        )}
        {isCenter && (
          <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center' }}>
            <span className={`badge badge-${member.membership_status}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
              {capitalize(member.membership_status)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Slot ─────────────────────────────────────────────────────────────────
function AddSlot({ label, onClick }) {
  return (
    <div className="tree-member-card">
      {label && <div className="tree-label">{label}</div>}
      <div className="tree-add-btn" onClick={onClick}>+ Add</div>
    </div>
  )
}

// ── Connector Lines ──────────────────────────────────────────────────────────
function VConnector() {
  return <div className="tree-connector-v" />
}

function GroupRow({ children }) {
  return (
    <div className="tree-row" style={{ gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {children}
    </div>
  )
}

// ── Main Tree View ────────────────────────────────────────────────────────────
function FamilyTreeView() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [allMembers, setAllMembers] = useState([])
  const [selectedId, setSelectedId] = useState(searchParams.get('member') || '')
  const [member, setMember] = useState(null)
  const [relationships, setRelationships] = useState([])
  const [loading, setLoading] = useState(false)

  // Add relationship modal
  const [addModal, setAddModal] = useState(null) // { type: 'spouse'|'father'|... }
  const [relTarget, setRelTarget] = useState('')
  const [addingRel, setAddingRel] = useState(false)
  const [suggestedMembers, setSuggestedMembers] = useState([])
  const [allRelationships, setAllRelationships] = useState([])

  // When the add modal opens, fetch all relationships to compute suggestions
  useEffect(() => {
    if (!addModal || !selectedId) return
    async function fetchRels() {
      const res = await fetch('/api/relationships')
      if (res.ok) {
        const rels = await res.json()
        setAllRelationships(rels)
        // Find members that may be related
        const myRels = rels.filter(r => r.member_id === selectedId)
        const myRelIds = new Set(myRels.map(r => r.related_member_id))
        const myRelRelIds = rels
          .filter(r => myRelIds.has(r.member_id) && r.related_member_id !== selectedId)
          .map(r => r.related_member_id)
        const sameLastName = allMembers.filter(m =>
          m.id !== selectedId &&
          m.last_name?.toLowerCase() === member?.last_name?.toLowerCase()
        )
        const suggestions = sameLastName.filter(m =>
          !myRelIds.has(m.id)
        )
        // Add indirectly related members (connected to my relatives)
        for (const rid of myRelRelIds) {
          if (!myRelIds.has(rid) && rid !== selectedId && !suggestions.some(s => s.id === rid)) {
            const m = allMembers.find(mm => mm.id === rid)
            if (m) suggestions.push(m)
          }
        }
        setSuggestedMembers(suggestions)
      }
    }
    fetchRels()
  }, [addModal, selectedId, member, allMembers])

  // Spouse anniversary modal
  const [spouseAnniversaryModal, setSpouseAnniversaryModal] = useState(false)
  const [spouseAnniversaryDate, setSpouseAnniversaryDate] = useState('')
  const [spouseMemberId, setSpouseMemberId] = useState('')
  const [savingSpouse, setSavingSpouse] = useState(false)

  // Parent confirmation modal (when both father & mother are linked)
  const [parentConfirmationModal, setParentConfirmationModal] = useState(false)
  const [parentAnniversaryDate, setParentAnniversaryDate] = useState('')
  const [parentFatherId, setParentFatherId] = useState('')
  const [parentMotherId, setParentMotherId] = useState('')
  const [savingParents, setSavingParents] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const res = await fetch('/api/members')
      if (res.ok) setAllMembers(await res.json())
    }
    init()
  }, [])

  const loadMember = useCallback(async (id) => {
    if (!id) return
    setLoading(true)
    const [mRes, rRes] = await Promise.all([
      fetch(`/api/members/${id}`),
      fetch(`/api/relationships?member_id=${id}`),
    ])
    if (mRes.ok) setMember(await mRes.json())
    if (rRes.ok) setRelationships(await rRes.json())
    setLoading(false)
  }, [])

  const clearMember = useCallback(() => {
    setMember(null)
    setRelationships([])
  }, [])

  useEffect(() => {
    if (selectedId) loadMember(selectedId)
    else clearMember()
  }, [selectedId, loadMember, clearMember])

  // Relationship lookups
  const getRelsByType = (type) => relationships.filter(r => r.relationship_type === type).map(r => r.related_member)
  const spouse = getRelsByType('spouse')[0]
  const father = getRelsByType('father')[0]
  const mother = getRelsByType('mother')[0]
  const siblings = getRelsByType('sibling')
  const children = getRelsByType('child')
  const grandchildren = getRelsByType('grandchild')

  function navigateTo(id) {
    setSelectedId(id)
    window.history.replaceState({}, '', `/family-tree?member=${id}`)
  }

  async function handleAddRel() {
    if (!relTarget || !addModal) return
    setAddingRel(true)
    const res = await fetch('/api/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: selectedId, related_member_id: relTarget, relationship_type: addModal.type }),
    })
    if (res.ok) {
      if (addModal.type === 'spouse') {
        setSpouseMemberId(relTarget)
        setRelTarget('')
        setAddModal(null)
        setSpouseAnniversaryModal(true)
        setAddingRel(false)
        return
      }

      await loadMember(selectedId)

      if (addModal.type === 'father' || addModal.type === 'mother') {
        const relRes = await fetch(`/api/relationships?member_id=${selectedId}`)
        if (relRes.ok) {
          const rels = await relRes.json()
          const fatherRel = rels.find(r => r.relationship_type === 'father')
          const motherRel = rels.find(r => r.relationship_type === 'mother')
          if (fatherRel && motherRel) {
            const [fRes, mRes] = await Promise.all([
              fetch(`/api/members/${fatherRel.related_member?.id}`),
              fetch(`/api/members/${motherRel.related_member?.id}`),
            ])
            if (fRes.ok && mRes.ok) {
              const fData = await fRes.json()
              const mData = await mRes.json()
              if (fData.relationship_status !== 'married' || mData.relationship_status !== 'married') {
                setParentFatherId(fatherRel.related_member?.id)
                setParentMotherId(motherRel.related_member?.id)
                setParentConfirmationModal(true)
              }
            }
          }
        }
      }

      setAddModal(null)
      setRelTarget('')
    }
    setAddingRel(false)
  }

  async function handleSaveSpouseAnniversary() {
    if (!spouseAnniversaryDate || !spouseMemberId) return
    setSavingSpouse(true)
    try {
      await Promise.all([
        fetch(`/api/members/${selectedId}`, {
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
      await loadMember(selectedId)
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

      const relRes = await fetch(`/api/relationships?member_id=${selectedId}`)
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
      await loadMember(selectedId)
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

  async function handleRemoveRel(relatedId, relType) {
    const rel = relationships.find(r => r.related_member?.id === relatedId && r.relationship_type === relType)
    if (!rel) return
    await fetch(`/api/relationships/${rel.id}`, { method: 'DELETE' })
    await loadMember(selectedId)
  }

  const linkedIds = new Set(relationships.map(r => r.related_member?.id))
  const availableForRel = allMembers.filter(m => m.id !== selectedId && !linkedIds.has(m.id))

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title">Family Tree</h1>
              <p className="page-subtitle">Visualize and manage family connections across groups</p>
            </div>
            <Link href="/members/new" className="btn btn-primary">
              <PlusIcon size={16} /> Add Member
            </Link>
          </div>

          {/* Member Selector */}
          <div className="card" style={{ marginBottom: '20px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                View tree for:
              </span>
              <select
                id="tree-member-select"
                className="form-select"
                style={{ flex: 1, minWidth: '220px', maxWidth: '400px' }}
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
              >
                <option value="">— Select a member —</option>
                {allMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.last_name}, {m.first_name} {m.middle_name || ''}
                    {m.family_groups?.name ? ` · ${m.family_groups.name}` : ''}
                  </option>
                ))}
              </select>
              {member && (
                <Link href={`/members/${selectedId}`} className="btn btn-ghost btn-sm">
                  View Profile →
                </Link>
              )}
            </div>
          </div>

          {/* Tree Visualization */}
          {!selectedId && (
            <div className="empty-state" style={{ marginTop: '60px' }}>
              <div className="empty-state-icon"><TreeIcon size={40} /></div>
              <div className="empty-state-text">Select a member above to view their family tree</div>
            </div>
          )}

          {selectedId && loading && (
            <div className="card skeleton" style={{ height: '520px' }} />
          )}

          {member && !loading && (
            <div className="card animate-fade-in-up">
              <div className="card-header">
                <h2 className="card-title"><TreeIcon size={18} /> {getFullName(member)}&apos;s Family Tree</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {relationships.length} connection{relationships.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="card-body" style={{ overflowX: 'auto' }}>
                <div className="tree-container">

                  {/* Row 1 — Parents */}
                  <GroupRow>
                    {father ? (
                      <TreeCard member={father} label="Father" onClick={navigateTo} onRemove={() => handleRemoveRel(father.id, 'father')} />
                    ) : (
                      <AddSlot label="Father" onClick={() => setAddModal({ type: 'father' })} />
                    )}
                    {mother ? (
                      <TreeCard member={mother} label="Mother" onClick={navigateTo} onRemove={() => handleRemoveRel(mother.id, 'mother')} />
                    ) : (
                      <AddSlot label="Mother" onClick={() => setAddModal({ type: 'mother' })} />
                    )}
                  </GroupRow>

                  <VConnector />

                  {/* Row 2 — Siblings | MEMBER | Spouse */}
                  <div className="tree-row-center">
                    {/* Siblings */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                      <div className="tree-label">Siblings</div>
                      {siblings.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {siblings.map(s => (
                            <TreeCard key={s.id} member={s} onClick={navigateTo} onRemove={() => handleRemoveRel(s.id, 'sibling')} />
                          ))}
                        </div>
                      )}
                      <AddSlot onClick={() => setAddModal({ type: 'sibling' })} />
                    </div>

                    <div className="tree-row-divider" />

                    {/* Center member */}
                    <TreeCard member={member} isCenter />

                    <div className="tree-row-divider" />

                    {/* Spouse */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div className="tree-label">Spouse</div>
                      {spouse ? (
                        <TreeCard member={spouse} onClick={navigateTo} onRemove={() => handleRemoveRel(spouse.id, 'spouse')} />
                      ) : (
                        <AddSlot onClick={() => setAddModal({ type: 'spouse' })} />
                      )}
                    </div>
                  </div>

                  <VConnector />

                  {/* Row 3 — Children */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div className="tree-label">Children</div>
                    <GroupRow>
                      {children.map(c => (
                        <TreeCard key={c.id} member={c} onClick={navigateTo} onRemove={() => handleRemoveRel(c.id, 'child')} />
                      ))}
                      <AddSlot onClick={() => setAddModal({ type: 'child' })} />
                    </GroupRow>
                  </div>

                  {grandchildren.length > 0 && (
                    <>
                      <VConnector />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div className="tree-label">Grandchildren</div>
                        <GroupRow>
                          {grandchildren.map(g => (
                            <TreeCard key={g.id} member={g} onClick={navigateTo} onRemove={() => handleRemoveRel(g.id, 'grandchild')} />
                          ))}
                          <AddSlot onClick={() => setAddModal({ type: 'grandchild' })} />
                        </GroupRow>
                      </div>
                    </>
                  )}

                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Relationship Modal */}
      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Link {getRelationshipLabel(addModal.type)}
              </h2>
              <button className="modal-close" onClick={() => setAddModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select Member</label>
                <select className="form-select" value={relTarget} onChange={e => setRelTarget(e.target.value)}>
                  <option value="">Choose a member…</option>
                  {suggestedMembers.length > 0 && (
                    <>
                      {suggestedMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.last_name}, {m.first_name} {m.middle_name || ''}
                          {m.family_groups?.name ? ` (${m.family_groups.name})` : ''}
                        </option>
                      ))}
                      <option disabled>──────────</option>
                    </>
                  )}
                  {availableForRel.filter(m => !suggestedMembers.some(s => s.id === m.id)).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.last_name}, {m.first_name} {m.middle_name || ''}
                      {m.family_groups?.name ? ` (${m.family_groups.name})` : ''}
                    </option>
                  ))}
                </select>
                <span className="form-hint">Members with the same last name or connected to your relatives shown first.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setAddModal(null); setRelTarget('') }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddRel} disabled={!relTarget || addingRel}>
                {addingRel ? 'Linking…' : `+ Link as ${getRelationshipLabel(addModal.type)}`}
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
    </div>
  )
}

export default function FamilyTreePage() {
  return (
    <Suspense fallback={<div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }} />}>
      <FamilyTreeView />
    </Suspense>
  )
}
