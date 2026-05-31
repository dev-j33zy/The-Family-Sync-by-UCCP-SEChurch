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
  home_address: '',
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = { ...form }

    try {
      const url = mode === 'edit' ? `/api/members/${member.id}` : '/api/members'
      const method = mode === 'edit' ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save member')

      router.push(`/members/${data.id}`)
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
              onChange={e => set('relationship_status', e.target.value)}>
              <option value="">Select status</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="widowed">Widowed</option>
              <option value="separated">Separated</option>
              <option value="divorced">Divorced</option>
            </select>
          </div>
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
          <div className="form-group form-group-full">
            <label className="form-label" htmlFor="home_address">Home Address</label>
            <textarea id="home_address" className="form-textarea" value={form.home_address}
              onChange={e => set('home_address', e.target.value)}
              placeholder="Street, Barangay, City, Province, ZIP" rows={2} />
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
    </form>
  )
}
