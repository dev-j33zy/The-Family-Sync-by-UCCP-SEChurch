'use client'
import { useState, useEffect, use } from 'react'
import Sidebar from '@/components/Sidebar'
import { SaveIcon } from '@/components/Icons'
import { useRouter } from 'next/navigation'
import { getFullName, todayDateString, membershipYearToDate, membershipDateToYear, isValidMembershipYear } from '@/lib/utils'
import { FrownIcon } from '@/components/Icons'
import Link from 'next/link'

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
  family_group_id: '',
}

function toFormMember(m) {
  if (!m) return { ...EMPTY_FORM }
  return {
    first_name: m.first_name || '',
    last_name: m.last_name || '',
    middle_name: m.middle_name || '',
    date_of_birth: m.date_of_birth ? String(m.date_of_birth).slice(0, 10) : '',
    gender: m.gender || '',
    citizenship: m.citizenship || '',
    relationship_status: m.relationship_status || '',
    wedding_anniversary: m.wedding_anniversary ? String(m.wedding_anniversary).slice(0, 10) : '',
    communicant_class_graduate: m.communicant_class_graduate || '',
    date_of_membership: membershipDateToYear(m.date_of_membership),
    membership_status: m.membership_status || 'new',
    membership_type: m.membership_type || '',
    phone_number: m.phone_number || '',
    email_address: m.email_address || '',
    street_address: m.street_address || '',
    village: m.village || '',
    barangay: m.barangay || '',
    city: m.city || '',
    family_group_id: m.family_group_id || '',
  }
}

export default function EditMemberPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [member, setMember] = useState(null)
  const [familyGroups, setFamilyGroups] = useState([])
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [mRes, gRes] = await Promise.all([
        fetch(`/api/members/${id}`, { cache: 'no-store' }),
        fetch('/api/family-groups'),
      ])
      if (mRes.ok) {
        const m = await mRes.json()
        setMember(m)
        setForm(toFormMember(m))
      }
      if (gRes.ok) setFamilyGroups(await gRes.json())
      setLoading(false)
    }
    load()
  }, [id])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!isValidMembershipYear(form.date_of_membership)) {
      setError(`Year of membership must be between 1900 and ${new Date().getFullYear()}`)
      return
    }

    setSaving(true)

    // A year is the only thing the form collects now. If the year did not
    // change, keep the exact date already on record (records imported with a
    // full date must not silently shift to January 1). A changed year becomes
    // January 1 of that year.
    const originalYear = member ? membershipDateToYear(member.date_of_membership) : ''
    const dateOfMembership = form.date_of_membership
      ? form.date_of_membership === originalYear
        ? String(member.date_of_membership).slice(0, 10)
        : membershipYearToDate(form.date_of_membership)
      : ''

    const res = await fetch(`/api/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, date_of_membership: dateOfMembership }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Failed to save member')
      setSaving(false)
      return
    }
    router.push(`/members/${data.id || id}`)
    router.refresh()
  }

  const projectedStatus = form.date_of_membership
    ? (form.membership_status === 'new' ? 'active' : form.membership_status)
    : form.membership_status
  const projectedType = form.date_of_membership
    ? (form.membership_type || 'regular')
    : form.membership_type

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="flex items-center gap-3 mb-4">
            <Link href={`/members/${id}`} className="btn btn-ghost btn-sm">← Back to Profile</Link>
          </div>
          <div className="page-header">
            <h1 className="page-title">Edit Member</h1>
            {member && <p className="page-subtitle">{getFullName(member)}</p>}
          </div>

          {loading ? (
            <div className="card skeleton" style={{ height: '500px' }} />
          ) : member ? (
            <div className="card">
              <div className="card-body">
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
                        <input id="date_of_birth" type="date" className="form-input" value={form.date_of_birth}
                          onChange={e => set('date_of_birth', e.target.value)} max={todayDateString()} required />
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
                            if (e.target.value !== 'married') set('wedding_anniversary', '')
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
                        <div className="form-group">
                          <label className="form-label" htmlFor="wedding_anniversary">Wedding Anniversary</label>
                          <input id="wedding_anniversary" type="date" className="form-input" value={form.wedding_anniversary}
                            onChange={e => set('wedding_anniversary', e.target.value)} max={todayDateString()} />
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
                        <label className="form-label" htmlFor="date_of_membership">Year of Membership (Baptism Year)</label>
                        <input id="date_of_membership" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                          className="form-input" placeholder="e.g. 2015" value={form.date_of_membership}
                          onChange={e => set('date_of_membership', e.target.value.replace(/\D/g, '').slice(0, 4))} />
                        <span className="form-hint">Setting this year marks the member as Active.</span>
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
                      <div className="form-group">
                        <label className="form-label" htmlFor="family_group_id">Family Group</label>
                        <select id="family_group_id" className="form-select" value={form.family_group_id}
                          onChange={e => set('family_group_id', e.target.value)}>
                          <option value="">No family group</option>
                          {(familyGroups || []).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
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

                  {/* ── ACTIONS ── */}
                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : <><SaveIcon size={16} /> Save Changes</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: '60px' }}>
              <div className="empty-state-icon"><FrownIcon size={40} /></div>
              <div className="empty-state-text">Member not found</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}