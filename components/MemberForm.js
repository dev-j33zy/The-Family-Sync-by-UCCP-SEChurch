'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { calculateAge, formatDateInput, renderDatePickerHeader } from '@/lib/utils'
import { SaveIcon, PlusIcon, CameraIcon } from '@/components/Icons'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import PhotoCropperModal from '@/components/PhotoCropper'

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

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  middle_name: '',
  date_of_birth: '',
  gender: '',
  citizenship: '',
  relationship_status: '',
  wedding_anniversary: '',
  communicant_class_graduate: '',
  date_of_membership: '',
  membership_status: 'new',
  membership_type: '',
  phone_number: '',
  email_address: '',
  street_address: '',
  village: '',
  barangay: '',
  city: '',
  profile_picture: '',
}

export default function MemberForm({ member, mode = 'create' }) {
  const router = useRouter()
  const cleanMember = member ? Object.fromEntries(
    Object.entries(member)
      .filter(([k]) => k in EMPTY_FORM)
      .map(([k, v]) => [k, v === null ? '' : v])
  ) : {}
  
  const [form, setForm] = useState(member ? {
    ...EMPTY_FORM,
    ...cleanMember,
    date_of_birth: formatDateInput(member.date_of_birth),
    wedding_anniversary: formatDateInput(member.wedding_anniversary),
    date_of_membership: formatDateInput(member.date_of_membership),
    membership_type: member.membership_type || '',
  } : { ...EMPTY_FORM })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const age = useMemo(() => calculateAge(form.date_of_birth), [form.date_of_birth])

  const [cropImage, setCropImage] = useState(null)
  const fileInputRef = useRef(null)

  const [spouseSearch, setSpouseSearch] = useState('')
  const [spouseSuggestions, setSpouseSuggestions] = useState([])
  const [spouseId, setSpouseId] = useState('')
  const [spouseName, setSpouseName] = useState('')
  const [showSpouseDropdown, setShowSpouseDropdown] = useState(false)
  const spouseTimeoutRef = useRef(null)

  const [confirmModal, setConfirmModal] = useState(null)
  const [createdMemberId, setCreatedMemberId] = useState(null)

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCropImage(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleCropDone(dataUrl) {
    set('profile_picture', dataUrl)
    setCropImage(null)
  }

  // Auto-set status/type preview based on date_of_membership
  const projectedStatus = form.date_of_membership ? 
    (form.membership_status === 'new' ? 'active' : form.membership_status) : 'new'
  const projectedType = form.date_of_membership ?
    (form.membership_type || 'regular') : form.membership_type

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function clearSpouse() {
    setSpouseSearch('')
    setSpouseSuggestions([])
    setSpouseId('')
    setSpouseName('')
    setShowSpouseDropdown(false)
  }

  function handleSpouseInput(e) {
    const val = e.target.value
    setSpouseSearch(val)
    if (!val.trim()) {
      setSpouseSuggestions([])
      setShowSpouseDropdown(false)
      return
    }
    if (spouseTimeoutRef.current) clearTimeout(spouseTimeoutRef.current)
    spouseTimeoutRef.current = setTimeout(async () => {
      const oppositeGender = form.gender === 'male' ? 'female' : form.gender === 'female' ? 'male' : ''
      if (!oppositeGender) return
      try {
        const res = await fetch(`/api/members?gender=${oppositeGender}&search=${encodeURIComponent(val)}`)
        if (res.ok) {
          const data = await res.json()
          const filtered = data.filter(m => mode !== 'edit' || m.id !== member.id)
          setSpouseSuggestions(filtered)
          setShowSpouseDropdown(filtered.length > 0)
        }
      } catch {}
    }, 300)
  }

  function selectSpouse(m) {
    setSpouseId(m.id)
    setSpouseName(`${m.first_name} ${m.last_name}`)
    setSpouseSearch(`${m.first_name} ${m.last_name}`)
    setShowSpouseDropdown(false)
  }

  async function doCreateMember(payload) {
    const url = '/api/members'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save member')
    return data
  }

  async function doLinkSpouse(memberId, spouseMemberId, anniversary, memberName, spouseMemberName) {
    await Promise.all([
      fetch(`/api/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationship_status: 'married', wedding_anniversary: anniversary }),
      }),
      fetch(`/api/members/${spouseMemberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationship_status: 'married', wedding_anniversary: anniversary }),
      }),
      fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, related_member_id: spouseMemberId, relationship_type: 'spouse' }),
      }),
    ])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = { ...form }
    delete payload.spouse_id

    try {
      if (mode === 'edit') {
        const url = `/api/members/${member.id}`
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to save member')
        router.push(`/members/${data.id}`)
        router.refresh()
      } else {
        const data = await doCreateMember(payload)
        if (spouseId) {
          setCreatedMemberId(data.id)
          setConfirmModal({
            memberId: data.id,
            spouseMemberId: spouseId,
            memberName: `${payload.first_name} ${payload.last_name}`,
            spouseName: spouseName,
            anniversary: payload.wedding_anniversary,
          })
          setSaving(false)
        } else {
          router.push(`/members/${data.id}`)
          router.refresh()
        }
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleConfirmSpouse(answer) {
    if (!confirmModal) return
    setSaving(true)
    try {
      if (answer === 'yes') {
        await doLinkSpouse(
          confirmModal.memberId,
          confirmModal.spouseMemberId,
          confirmModal.anniversary,
          confirmModal.memberName,
          confirmModal.spouseName
        )
      }
      setConfirmModal(null)
      setCreatedMemberId(null)
      router.push(`/members/${confirmModal.memberId}`)
      router.refresh()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in-up">
      {error && (
        <div className="login-error" style={{ marginBottom: '24px' }}>{error}</div>
      )}

      {/* ── PERSONAL INFORMATION ── */}
      <div className="form-section">
        <div className="form-section-title">Personal Information</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="first_name">First Name <span className="required">*</span></label>
            <input id="first_name" className="form-input" value={form.first_name}
              onChange={e => set('first_name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="last_name">Last Name <span className="required">*</span></label>
            <input id="last_name" className="form-input" value={form.last_name}
              onChange={e => set('last_name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="middle_name">Middle Name <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(optional)</span></label>
            <input id="middle_name" className="form-input" value={form.middle_name}
              onChange={e => set('middle_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="gender">Gender <span className="required">*</span></label>
            <select id="gender" className="form-select" value={form.gender}
              onChange={e => set('gender', e.target.value)} required>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="date_of_birth">Date of Birth <span className="required">*</span></label>
            <div style={{ width: '100%' }}>
              <DatePicker
                id="date_of_birth"
                selected={parseDateString(form.date_of_birth)}
                onChange={date => set('date_of_birth', toDateString(date))}
                className="form-input"
                dateFormat="yyyy-MM-dd"
                maxDate={new Date()}
                renderCustomHeader={renderDatePickerHeader}
                placeholderText="Select date"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="age">Age</label>
            <input id="age" className="form-input" value={age !== null ? `${age} years old` : '—'}
              readOnly style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div className="form-group form-group-full">
            <label className="form-label" htmlFor="citizenship">Citizenship</label>
            <input id="citizenship" className="form-input" value={form.citizenship}
              onChange={e => set('citizenship', e.target.value)} placeholder="e.g. Filipino" />
          </div>
        </div>
      </div>

      {/* ── RELATIONSHIP STATUS ── */}
      <div className="form-section">
        <div className="form-section-title">Relationship Status</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="relationship_status">Relationship Status</label>
            <select id="relationship_status" className="form-select" value={form.relationship_status}
              onChange={e => {
                set('relationship_status', e.target.value)
                if (e.target.value !== 'married') clearSpouse()
              }}>
              <option value="">Select status</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced</option>
            </select>
          </div>
          {form.relationship_status === 'married' && (
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label" htmlFor="spouse_search">Spouse</label>
              <input
                id="spouse_search"
                className="form-input"
                placeholder="Spouse name…"
                value={spouseSearch}
                onChange={handleSpouseInput}
                onFocus={() => spouseSuggestions.length > 0 && setShowSpouseDropdown(true)}
                onBlur={() => setTimeout(() => setShowSpouseDropdown(false), 200)}
              />
              {spouseId && spouseName && (
                <div style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '2px' }}>
                  Selected: {spouseName}
                </div>
              )}
              {showSpouseDropdown && spouseSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', maxHeight: '200px', overflowY: 'auto',
                  boxShadow: 'var(--shadow)',
                }}>
                  {spouseSuggestions.map(m => {
                    const initials = `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase()
                    return (
                      <div
                        key={m.id}
                        onMouseDown={() => selectSpouse(m)}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                          fontSize: '0.875rem', borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: m.gender === 'male' ? 'var(--primary-light)' : 'var(--secondary-light)',
                          color: m.gender === 'male' ? 'var(--primary)' : 'var(--secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                        }}>{initials}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{m.first_name} {m.last_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{m.gender}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {form.relationship_status === 'married' && (
            <div className="form-group">
              <label className="form-label" htmlFor="wedding_anniversary">Wedding Anniversary</label>
              <div style={{ width: '100%' }}>
                <DatePicker
                  id="wedding_anniversary"
                  selected={parseDateString(form.wedding_anniversary)}
                  onChange={date => set('wedding_anniversary', toDateString(date))}
                  className="form-input"
                  dateFormat="yyyy-MM-dd"
                  maxDate={new Date()}
                  renderCustomHeader={renderDatePickerHeader}
                  placeholderText="Select date"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MEMBERSHIP DETAILS ── */}
      <div className="form-section">
        <div className="form-section-title">Membership Details</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="communicant_class_graduate">Communicant Class Graduate</label>
            <select id="communicant_class_graduate" className="form-select" value={form.communicant_class_graduate}
              onChange={e => set('communicant_class_graduate', e.target.value)}>
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="date_of_membership">Date of Membership (Baptism Date)</label>
            <div style={{ width: '100%' }}>
              <DatePicker
                id="date_of_membership"
                selected={parseDateString(form.date_of_membership)}
                onChange={date => set('date_of_membership', toDateString(date))}
                className="form-input"
                dateFormat="yyyy-MM-dd"
                maxDate={new Date()}
                renderCustomHeader={renderDatePickerHeader}
                placeholderText="Select date"
              />
            </div>
            <span className="form-hint">Setting this date marks the member as Active.</span>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="membership_status">Membership Status</label>
            <select id="membership_status" className="form-select" value={form.date_of_membership ? projectedStatus : form.membership_status}
              onChange={e => set('membership_status', e.target.value)}
              disabled={!!form.date_of_membership && form.membership_status === 'new'}>
              <option value="new">New</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {form.date_of_membership && form.membership_status === 'new' && (
              <span className="form-hint" style={{ color: 'var(--primary)' }}>Auto-set to Active via membership date.</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="membership_type">Membership Type</label>
            <select id="membership_type" className="form-select" value={projectedType}
              onChange={e => set('membership_type', e.target.value)}>
              <option value="">{form.date_of_membership ? 'Regular (default)' : 'None (member is new)'}</option>
              <option value="regular">Regular</option>
              <option value="associate">Associate</option>
              <option value="affiliate">Affiliate</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── CONTACT INFORMATION ── */}
      <div className="form-section">
        <div className="form-section-title">Contact Information <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', fontSize: '0.75rem', letterSpacing: 0 }}>(optional)</span></div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="phone_number">Phone Number</label>
            <input id="phone_number" type="tel" className="form-input" value={form.phone_number}
              onChange={e => set('phone_number', e.target.value)} placeholder="+63 9XX XXX XXXX" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="email_address">Email Address</label>
            <input id="email_address" type="email" className="form-input" value={form.email_address}
              onChange={e => set('email_address', e.target.value)} placeholder="member@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="street_address">Street Address</label>
            <input id="street_address" className="form-input" value={form.street_address}
              onChange={e => set('street_address', e.target.value)} placeholder="House/Street/Purok" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="village">Village</label>
            <input id="village" className="form-input" value={form.village}
              onChange={e => set('village', e.target.value)} placeholder="Village/Subdivision" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="barangay">Barangay</label>
            <input id="barangay" className="form-input" value={form.barangay}
              onChange={e => set('barangay', e.target.value)} placeholder="Barangay" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="city">City</label>
            <input id="city" className="form-input" value={form.city}
              onChange={e => set('city', e.target.value)} placeholder="City/Municipality" />
          </div>
        </div>
      </div>

      {/* ── PROFILE PHOTO ── */}
      <div className="form-section">
        <div className="form-section-title">Profile Photo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden',
              background: 'var(--bg-input)', border: '2px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {form.profile_picture ? (
              <img src={form.profile_picture} alt="Profile"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <CameraIcon size={28} style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
              <CameraIcon size={14} /> {form.profile_picture ? 'Change Photo' : 'Add Photo'}
            </button>
            {form.profile_picture && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: '8px' }}
                onClick={() => set('profile_picture', '')}>Remove</button>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              JPEG or PNG
            </div>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }}
          onChange={handleFileSelect} />
      </div>

      {/* ── ACTIONS ── */}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : mode === 'edit' ? <><SaveIcon size={16} /> Save Changes</> : <><PlusIcon size={16} /> Add Member</>}
        </button>
      </div>

      {cropImage && (
        <PhotoCropperModal
          imageSrc={cropImage}
          onCrop={handleCropDone}
          onCancel={() => setCropImage(null)}
        />
      )}

      {confirmModal && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Link Spouse?</h2>
              <button className="modal-close" onClick={() => {
                setConfirmModal(null)
                setCreatedMemberId(null)
                if (createdMemberId) {
                  setSaving(true)
                  router.push(`/members/${createdMemberId}`)
                  router.refresh()
                }
              }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                Would you like to update the anniversary date and family tree links for both{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{confirmModal.memberName}</strong>
                {' '}and{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{confirmModal.spouseName}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => handleConfirmSpouse('no')}>
                No, Save New Member Only
              </button>
              <button className="btn btn-primary" onClick={() => handleConfirmSpouse('yes')}>
                Yes, Update Both
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
