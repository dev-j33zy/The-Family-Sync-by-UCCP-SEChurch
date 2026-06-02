'use client'
import { useState, useMemo, useRef } from 'react'
import { calculateAge, renderDatePickerHeader } from '@/lib/utils'
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
  phone_number: '',
  email_address: '',
  street_address: '',
  village: '',
  barangay: '',
  city: '',
  profile_picture: '',
}

const COMPARE_FIELDS = [
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'middle_name', label: 'Middle Name' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'citizenship', label: 'Citizenship' },
  { key: 'relationship_status', label: 'Relationship Status' },
  { key: 'wedding_anniversary', label: 'Wedding Anniversary' },
  { key: 'communicant_class_graduate', label: 'Communicant Class Graduate' },
  { key: 'date_of_membership', label: 'Date of Membership' },
  { key: 'phone_number', label: 'Phone Number' },
  { key: 'email_address', label: 'Email Address' },
  { key: 'street_address', label: 'Street Address' },
  { key: 'village', label: 'Village' },
  { key: 'barangay', label: 'Barangay' },
  { key: 'city', label: 'City' },
]

const DPA_TEXT = (
  <div>
    <p style={{ marginBottom: '12px' }}>
      Republic Act No. 10173, otherwise known as the <strong>Data Privacy Act of 2012</strong>,
      is hereby adopted by the church in the processing of your personal information.
    </p>
    <p style={{ marginBottom: '12px' }}>
      In compliance with this law, we are providing you with the following information regarding
      the collection, processing, and storage of your personal data:
    </p>
    <p style={{ marginBottom: '8px', fontWeight: 600 }}>Collection and Use of Information</p>
    <p style={{ marginBottom: '12px' }}>
      We collect personal information such as your full name, date of birth, gender, contact details,
      and other relevant data for the purpose of church membership registration and record-keeping.
      This information will be used exclusively for church-related activities, communication,
      and pastoral care.
    </p>
    <p style={{ marginBottom: '8px', fontWeight: 600 }}>Data Sharing and Disclosure</p>
    <p style={{ marginBottom: '12px' }}>
      Your personal information will be kept confidential and will only be accessed by authorized
      church personnel. We do not share your information with third parties except when required
      by law or with your explicit consent.
    </p>
    <p style={{ marginBottom: '8px', fontWeight: 600 }}>Data Retention and Security</p>
    <p style={{ marginBottom: '12px' }}>
      Your data will be retained for as long as you are a registered member of the church.
      We implement appropriate security measures to protect your personal information against
      unauthorized access, alteration, disclosure, or destruction.
    </p>
    <p style={{ marginBottom: '8px', fontWeight: 600 }}>Your Rights</p>
    <p style={{ marginBottom: '12px' }}>
      Under the Data Privacy Act, you have the right to access, correct, update, or request the
      deletion of your personal information. You may also withdraw your consent to the processing
      of your data at any time by contacting the church data protection officer.
    </p>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
      By accepting below, you acknowledge that you have read and understood this privacy notice
      and consent to the collection and processing of your personal information for the purposes
      described above.
    </p>
  </div>
)

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatVal(val) {
  if (!val || val === '') return '\u2014'
  return capitalize(String(val))
}

export default function RegisterPage() {
  const [step, setStep] = useState('disclaimer')
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [matchedMember, setMatchedMember] = useState(null)
  const [selectedFields, setSelectedFields] = useState([])
  const fileInputRef = useRef(null)

  const [spouseSearch, setSpouseSearch] = useState('')
  const [spouseSuggestions, setSpouseSuggestions] = useState([])
  const [spouseId, setSpouseId] = useState('')
  const [spouseName, setSpouseName] = useState('')
  const [showSpouseDropdown, setShowSpouseDropdown] = useState(false)
  const spouseTimeoutRef = useRef(null)

  const [confirmModal, setConfirmModal] = useState(null)
  const [createdMemberId, setCreatedMemberId] = useState(null)
 
  const age = useMemo(() => calculateAge(form.date_of_birth), [form.date_of_birth])
 
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
          setSpouseSuggestions(data)
          setShowSpouseDropdown(data.length > 0)
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

  async function doLinkSpouse(memberId, spouseMemberId, anniversary) {
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

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      set('profile_picture', ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleAcceptDisclaimer() {
    setDisclaimerAccepted(true)
    setStep('form')
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM })
    setMatchedMember(null)
    setSelectedFields([])
    setError('')
    setSaving(false)
    setStep('form')
    setSpouseSearch('')
    setSpouseSuggestions([])
    setSpouseId('')
    setSpouseName('')
    setShowSpouseDropdown(false)
    setConfirmModal(null)
    setCreatedMemberId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = { ...form }
      if (payload.relationship_status !== 'married') {
        payload.wedding_anniversary = ''
      }

      const searchRes = await fetch(
        `/api/members?search=${encodeURIComponent(payload.first_name)}`
      )
      const allMembers = await searchRes.json()

      const match = allMembers.find(m =>
        m.first_name?.toLowerCase() === payload.first_name.toLowerCase() &&
        m.last_name?.toLowerCase() === payload.last_name.toLowerCase()
      )

      if (match) {
        const diffs = COMPARE_FIELDS.filter(f => {
          const existing = (match[f.key] || '').toString().toLowerCase()
          const incoming = (payload[f.key] || '').toString().toLowerCase()
          return existing !== incoming
        })
        setMatchedMember(match)
        setSelectedFields(diffs.map(f => f.key))
        setStep('review')
        setSaving(false)
        return
      }

      await submitNew(payload)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function submitNew(payload) {
    setSaving(true)
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit registration')

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
        setStep('success')
      }
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleConfirmSpouse(answer) {
    if (!confirmModal) return
    setSaving(true)
    try {
      if (answer === 'yes') {
        await doLinkSpouse(
          confirmModal.memberId,
          confirmModal.spouseMemberId,
          confirmModal.anniversary
        )
      }
      setConfirmModal(null)
      setCreatedMemberId(null)
      setStep('success')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  function handleSkipConfirm() {
    if (createdMemberId) {
      setStep('success')
    }
    setConfirmModal(null)
    setCreatedMemberId(null)
  }

  async function handleUpdateExisting() {
    if (!matchedMember) return
    setSaving(true)
    setError('')
    try {
      const fieldsToUpdate = selectedFields.length > 0 ? selectedFields : COMPARE_FIELDS.map(f => f.key)
      const payload = {}
      for (const key of fieldsToUpdate) {
        payload[key] = form[key]
      }
      if (payload.relationship_status && payload.relationship_status !== 'married') {
        payload.wedding_anniversary = null
      }

      const res = await fetch(`/api/members/${matchedMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update member')
      setStep('success')
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleRegisterAsNew() {
    setError('')
    setSaving(true)
    try {
      const payload = { ...form }
      if (payload.relationship_status !== 'married') {
        payload.wedding_anniversary = ''
      }

      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit registration')
      setMatchedMember(null)

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
        setStep('success')
      }
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  if (step === 'disclaimer') {
    return (
      <div className="register-page">
        <div className="register-bg" />
        <div className="register-card register-card-wide">
          <div className="register-logo">SEC</div>
          <h1 className="register-title">Membership Registration</h1>
          <p className="register-subtitle">Data Privacy Notice</p>
          <div className="register-dpa-content">
            {DPA_TEXT}
          </div>
          <div style={{ marginTop: '24px' }}>
            <label className="register-checkbox-label">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={e => setDisclaimerAccepted(e.target.checked)}
                className="register-checkbox"
              />
              <span>I have read and agree to the Data Privacy Notice</span>
            </label>
          </div>
          <button
            className="btn btn-primary register-btn"
            disabled={!disclaimerAccepted}
            onClick={handleAcceptDisclaimer}
            style={{ marginTop: '20px', width: '100%' }}
          >
            Proceed to Registration Form
          </button>
        </div>
      </div>
    )
  }

  if (step === 'review' && matchedMember) {
    const differences = COMPARE_FIELDS.filter(f => {
      const existing = (matchedMember[f.key] || '').toString().toLowerCase()
      const incoming = (form[f.key] || '').toString().toLowerCase()
      return existing !== incoming
    })

    return (
      <div className="register-page">
        <div className="register-bg" />
        <div className="register-card register-card-wide">
          <div className="register-duplicate-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--amber)' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="register-title">Member Already Registered</h1>
          <p className="register-subtitle">
            A member with the name <strong>{form.first_name} {form.last_name}</strong> already exists in our records.
          </p>

          <div className="register-compare-section">
            <h3 className="register-compare-heading">
              {differences.length > 0
                ? 'Select the fields you want to update:'
                : 'All information matches our existing records.'}
            </h3>
            {differences.length > 0 && (
              <div className="register-compare-table">
                <div className="register-compare-header">
                  <span className="register-compare-col-check" />
                  <span className="register-compare-col-field">Field</span>
                  <span className="register-compare-col-new">Your New Input</span>
                </div>
                {differences.map(f => {
                  const checked = selectedFields.includes(f.key)
                  return (
                    <div
                      key={f.key}
                      className={`register-compare-row register-compare-diff ${checked ? '' : 'register-compare-unchecked'}`}
                      onClick={() => {
                        setSelectedFields(prev =>
                          prev.includes(f.key)
                            ? prev.filter(k => k !== f.key)
                            : [...prev, f.key]
                        )
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="register-compare-col-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          className="register-compare-checkbox"
                          onClick={e => e.stopPropagation()}
                        />
                      </span>
                      <span className="register-compare-col-field">{f.label}</span>
                      <span className="register-compare-col-new">{formatVal(form[f.key])}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '8px' }}>
              {selectedFields.length === 0
                ? 'No fields selected \u2014 all changes will be applied.'
                : `${selectedFields.length} field${selectedFields.length > 1 ? 's' : ''} selected for update.`}
            </p>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', margin: '16px 0' }}>
            Is this you? Confirm to update your information.
          </p>

          {error && (
            <div className="login-error" style={{ marginBottom: '16px' }}>{error}</div>
          )}

          <div className="register-compare-actions">
            <button
              className="btn btn-primary"
              onClick={handleUpdateExisting}
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? 'Updating\u2026' : 'Yes, Update My Info'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleRegisterAsNew}
              disabled={saving}
              style={{ flex: 1 }}
            >
              No, Register as New
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="register-page">
        <div className="register-bg" />
        <div className="register-card register-card-narrow" style={{ textAlign: 'center' }}>
          <div className="register-success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--green)' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="register-title" style={{ marginTop: '16px' }}>Thank You!</h1>
          <p className="register-subtitle" style={{ marginBottom: '16px' }}>
            Your membership information has been submitted successfully.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            We appreciate you providing your membership details. A church representative
            will review your information and may reach out to you if needed.
          </p>
          <button
            className="btn btn-secondary"
            onClick={resetForm}
            style={{ marginTop: '24px', width: '100%' }}
          >
            Register Another Member
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '16px' }}>
            Or you may close this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="register-page">
      <div className="register-bg" />
      <div className="register-card register-card-wide">
        <div className="register-logo">SEC</div>
        <h1 className="register-title">Membership Registration Form</h1>
        <p className="register-subtitle">Please fill in your details below</p>

        {error && (
          <div className="login-error" style={{ marginBottom: '20px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
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
                <input id="age" className="form-input" value={age !== null ? `${age} years old` : '\u2014'}
                  readOnly style={{ color: 'var(--text-secondary)' }} />
              </div>
              <div className="form-group form-group-full">
                <label className="form-label" htmlFor="citizenship">Citizenship</label>
                <input id="citizenship" className="form-input" value={form.citizenship}
                  onChange={e => set('citizenship', e.target.value)} placeholder="e.g. Filipino" />
              </div>
            </div>
          </div>

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
                  <label className="form-label" htmlFor="register_spouse_search">Spouse</label>
                  <input
                    id="register_spouse_search"
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
                              fontSize: '0.875rem', borderBottom: '1px solid var(--border)',
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
                <span className="form-hint">The date you were baptized or became a member.</span>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Contact Information</div>
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

          <div className="form-section">
            <div className="form-section-title">Profile Photo <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', fontSize: '0.75rem', letterSpacing: 0 }}>(optional)</span></div>
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
                  <CameraIcon />
                )}
              </div>
              <div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
                  {form.profile_picture ? 'Change Photo' : 'Add Photo'}
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

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Submitting\u2026' : 'Submit Registration'}
            </button>
          </div>
        </form>
      </div>

      {confirmModal && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Link Spouse?</h2>
              <button className="modal-close" onClick={handleSkipConfirm}>×</button>
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
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
