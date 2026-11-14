'use client'
import { useState, useEffect, useMemo } from 'react'
import Sidebar from '@/components/Sidebar'
import {
  MessageIcon,
  SendIcon,
  SearchIcon,
  UsersIcon,
  CheckIcon,
  AlertCircleIcon,
} from '@/components/Icons'
import {
  normalizePhone,
  renderTemplate,
  estimateSegments,
  countCharacters,
  isOverLimit,
  MAX_MESSAGE_LENGTH,
  TEMPLATE_TOKEN_LIST,
} from '@/lib/sms-format'
import { formatDate } from '@/lib/utils'

const MEMBER_STATUSES = ['new', 'active', 'dormant', 'cancelled']
const MEMBER_TYPES = ['regular', 'associate', 'affiliate']
const GENDERS = ['male', 'female', 'other']

const EMPTY_FILTERS = {
  family_group_id: '',
  status: '',
  type: '',
  gender: '',
  address_area: '',
  search: '',
}

const STATUS_LABELS = {
  sent: 'Sent',
  failed: 'Failed',
  skipped: 'Skipped',
  pending: 'Pending',
}

function memberName(m) {
  return [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Unnamed member'
}

export default function SmsClient() {
  const [view, setView] = useState('compose')

  const [message, setMessage] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [familyGroups, setFamilyGroups] = useState([])
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [selected, setSelected] = useState([])
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [blasts, setBlasts] = useState([])
  const [loadingBlasts, setLoadingBlasts] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // =============================================
  // LOADING
  // =============================================

  async function loadBlasts() {
    setLoadingBlasts(true)
    const res = await fetch('/api/text-blasts', { cache: 'no-store' })
    if (res.ok) setBlasts(await res.json())
    setLoadingBlasts(false)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/family-groups', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((groups) => { if (!cancelled) setFamilyGroups(groups || []) })
    return () => { cancelled = true }
  }, [])

  // Every filter change refetches the audience. Debounced so that typing in
  // the search box does not fire a request per keystroke. The loading flag is
  // raised inside the timer so it stays off the synchronous render path.
  useEffect(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    const qs = params.toString()

    const timer = setTimeout(async () => {
      setLoadingMembers(true)
      const res = await fetch(`/api/members${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
      if (res.ok) setMembers(await res.json())
      setLoadingMembers(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [filters])

  // =============================================
  // DERIVED
  // =============================================

  const callableMembers = useMemo(
    () => members.filter((m) => normalizePhone(m.phone_number)),
    [members]
  )

  const selectedMembers = useMemo(
    () => members.filter((m) => selected.includes(m.id)),
    [members, selected]
  )

  const selectedCallable = useMemo(
    () => selectedMembers.filter((m) => normalizePhone(m.phone_number)),
    [selectedMembers]
  )

  const selectedMissingPhone = selectedMembers.length - selectedCallable.length

  // Segment cost depends on each member's rendered name, so use the worst
  // case across the selection. With nothing picked yet, approximate a long
  // name so the counter does not understate the cost.
  const segments = useMemo(() => {
    if (!message.trim()) return 0
    const sample = selectedMembers.length
      ? selectedMembers
      : [{ first_name: 'MMMMMMMMMM', last_name: 'LLLLLLLLLL' }]
    return Math.max(...sample.map((m) => estimateSegments(renderTemplate(message, m))))
  }, [message, selectedMembers])

  const charCount = countCharacters(message)
  const overLimit = isOverLimit(message)
  const canSend = message.trim().length > 0 && selectedCallable.length > 0 && !overLimit

  // =============================================
  // HANDLERS
  // =============================================

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
  }

  // History is fetched on demand rather than on mount, so the compose view
  // does not pay for a request it will not render.
  function switchView(next) {
    setError('')
    setSuccess('')
    setView(next)
    if (next === 'history' && blasts.length === 0) loadBlasts()
  }

  function toggleMember(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function selectAll() {
    setSelected(callableMembers.map((m) => m.id))
  }

  function clearSelection() {
    setSelected([])
  }

  function openConfirm() {
    setError('')
    setConfirmOpen(true)
  }

  async function handleSend() {
    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/text-blasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          filters,
          // Derived ids only, so a member filtered out of the current
          // audience can never ride along in a stale selection.
          memberIds: selectedMembers.map((m) => m.id),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Failed to send the blast')
        setConfirmOpen(false)
        return
      }

      const b = data.blast
      setConfirmOpen(false)
      setSelected([])
      setMessage('')
      setSuccess(
        `Blast sent to ${b.sent_count} recipient${b.sent_count === 1 ? '' : 's'}.` +
          (b.failed_count ? ` ${b.failed_count} failed.` : '') +
          (b.skipped_count ? ` ${b.skipped_count} skipped without a usable number.` : '')
      )
      setView('history')
      await loadBlasts()
    } catch (err) {
      setError(err.message || 'Network error while sending the blast')
      setConfirmOpen(false)
    } finally {
      setSending(false)
    }
  }

  async function openDetail(id) {
    setLoadingDetail(true)
    setError('')
    const res = await fetch(`/api/text-blasts/${id}`, { cache: 'no-store' })
    if (res.ok) {
      setDetail(await res.json())
    } else {
      setError('Could not load that blast')
    }
    setLoadingDetail(false)
  }

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title">SMS</h1>
              <p className="page-subtitle">
                {view === 'compose'
                  ? 'Send one message to a group of members'
                  : 'Review every message you have sent'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={`btn btn-ghost btn-sm${view === 'compose' ? ' active' : ''}`}
                onClick={() => switchView('compose')}
              >
                <SendIcon size={16} /> Compose
              </button>
              <button
                className={`btn btn-ghost btn-sm${view === 'history' ? ' active' : ''}`}
                onClick={() => switchView('history')}
              >
                History
              </button>
            </div>
          </div>

          {error && <div className="settings-alert error"><AlertCircleIcon size={16} /> {error}</div>}
          {success && <div className="settings-alert success"><CheckIcon size={16} /> {success}</div>}

          {view === 'compose' ? (
            <>
              {/* ---------------------------------------------- MESSAGE */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                  <h2 className="card-title" style={{ margin: 0 }}>1. Message</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label" htmlFor="blast-message">Message body</label>
                    <textarea
                      id="blast-message"
                      className="form-textarea"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={'Hi {first_name}, this is a reminder from The Family Sync.'}
                    />
                    <div className="blast-msg-meta">
                      <span>Personalise with: {TEMPLATE_TOKEN_LIST.map((t) => `{${t}}`).join('  ')}</span>
                      <span className={overLimit ? 'over-limit' : ''}>
                        {charCount} / {MAX_MESSAGE_LENGTH} chars &middot; ~{segments} segment{segments === 1 ? '' : 's'} each
                      </span>
                    </div>
                    {overLimit && (
                      <div className="settings-alert error" style={{ marginTop: '12px', marginBottom: 0 }}>
                        <AlertCircleIcon size={16} /> Message exceeds {MAX_MESSAGE_LENGTH} characters.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------- AUDIENCE */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                  <h2 className="card-title" style={{ margin: 0 }}>2. Audience</h2>
                </div>
                <div className="card-body">
                  <div className="filter-bar" style={{ marginBottom: 0 }}>
                    <div className="search-wrapper">
                      <span className="search-icon"><SearchIcon size={16} /></span>
                      <input
                        id="blast-search"
                        className="form-input search-input"
                        placeholder="Search by first or last name…"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                      />
                    </div>
                    <select
                      className="form-select filter-select filter-dropdown"
                      value={filters.family_group_id}
                      onChange={(e) => handleFilterChange('family_group_id', e.target.value)}
                    >
                      <option value="">All Family Groups</option>
                      {familyGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <select
                      className="form-select filter-select filter-dropdown"
                      value={filters.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      {MEMBER_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    <select
                      className="form-select filter-select filter-dropdown"
                      value={filters.type}
                      onChange={(e) => handleFilterChange('type', e.target.value)}
                    >
                      <option value="">All Types</option>
                      {MEMBER_TYPES.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                    <select
                      className="form-select filter-select filter-dropdown"
                      value={filters.gender}
                      onChange={(e) => handleFilterChange('gender', e.target.value)}
                    >
                      <option value="">All Genders</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                      ))}
                    </select>
                    <input
                      className="form-input filter-input"
                      placeholder="Village, barangay or city…"
                      value={filters.address_area}
                      onChange={(e) => handleFilterChange('address_area', e.target.value)}
                    />
                    {Object.values(filters).some(Boolean) && (
                      <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
                    )}
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------- RECIPIENTS */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header flex items-center justify-between">
                  <h2 className="card-title" style={{ margin: 0 }}>3. Recipients</h2>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={selectAll} disabled={!callableMembers.length}>
                      Select all with phone
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={!selected.length}>
                      Clear selection
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="blast-count-bar">
                    {loadingMembers
                      ? 'Loading members…'
                      : `${members.length} member${members.length === 1 ? '' : 's'} match · ${callableMembers.length} with a usable number · ${selected.length} selected`}
                  </div>

                  {loadingMembers ? (
                    <div className="card skeleton" style={{ height: '200px' }} />
                  ) : members.length === 0 ? (
                    <div className="empty-state" style={{ padding: '40px 20px' }}>
                      <div className="empty-state-icon"><UsersIcon size={36} /></div>
                      <div className="empty-state-text">No members match these filters</div>
                    </div>
                  ) : (
                    <div className="blast-recipient-list">
                      {members.map((m) => {
                        const phone = normalizePhone(m.phone_number)
                        const isSelected = selected.includes(m.id)
                        return (
                          <label
                            key={m.id}
                            className={`blast-recipient-row${phone ? '' : ' disabled'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!phone}
                              onChange={() => toggleMember(m.id)}
                            />
                            <span>
                              <strong>{memberName(m)}</strong>
                              <small>{phone || 'No phone number on file'}</small>
                            </span>
                            {!phone && <span className="badge badge-skipped">Skipped</span>}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button className="btn btn-primary" disabled={!canSend} onClick={openConfirm}>
                  <SendIcon size={16} />
                  {canSend
                    ? `Send to ${selectedCallable.length} recipient${selectedCallable.length === 1 ? '' : 's'}`
                    : 'Send Blast'}
                </button>
              </div>
            </>
          ) : (
            /* ---------------------------------------------- HISTORY */
            loadingBlasts ? (
              <div className="card skeleton" style={{ height: '300px' }} />
            ) : blasts.length === 0 ? (
              <div className="card">
                <div className="empty-state" style={{ padding: '64px 20px' }}>
                  <div className="empty-state-icon"><MessageIcon size={40} /></div>
                  <div className="empty-state-text">No messages sent yet</div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '16px' }}
                    onClick={() => switchView('compose')}
                  >
                    <SendIcon size={16} /> Compose your first message
                  </button>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Message</th>
                        <th>Sent</th>
                        <th className="mobile-hide">Failed</th>
                        <th className="mobile-hide">Skipped</th>
                        <th className="mobile-hide">Status</th>
                        <th className="mobile-hide">Sender</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blasts.map((b) => (
                        <tr
                          key={b.id}
                          className="clickable-row"
                          onClick={() => openDetail(b.id)}
                        >
                          <td>
                            <div className="blast-preview">{b.message}</div>
                          </td>
                          <td>{b.sent_count} / {b.recipient_count}</td>
                          <td className="mobile-hide">
                            {b.failed_count ? <span className="badge badge-failed">{b.failed_count}</span> : '—'}
                          </td>
                          <td className="mobile-hide">
                            {b.skipped_count ? <span className="badge badge-skipped">{b.skipped_count}</span> : '—'}
                          </td>
                          <td className="mobile-hide">
                            <span className={`badge badge-${b.status}`}>{STATUS_LABELS[b.status] || b.status}</span>
                          </td>
                          <td className="mobile-hide" style={{ color: 'var(--text-secondary)' }}>
                            {b.sender_name || '—'}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDate(b.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </main>

      {/* ---------------------------------------------- CONFIRM MODAL */}
      {confirmOpen && (
        <div className="modal-overlay" onClick={() => !sending && setConfirmOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm send</h2>
              <button className="modal-close" onClick={() => setConfirmOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 0 }}>
                This sends one message to <strong style={{ color: 'var(--text-primary)' }}>
                  {selectedCallable.length} recipient{selectedCallable.length === 1 ? '' : 's'}
                </strong> immediately.
              </p>
              {selectedMissingPhone > 0 && (
                <div className="settings-alert error" style={{ marginTop: 0 }}>
                  <AlertCircleIcon size={16} />
                  {selectedMissingPhone} selected member{selectedMissingPhone === 1 ? ' has' : 's have'} no usable
                  number and will be recorded as skipped.
                </div>
              )}
              <div className="blast-confirm-stats">
                <div><span>Recipients</span><strong>{selectedMembers.length}</strong></div>
                <div><span>Will send</span><strong>{selectedCallable.length}</strong></div>
                <div><span>Segments each</span><strong>{segments}</strong></div>
              </div>
              <div className="blast-confirm-preview">{renderTemplate(message, selectedMembers[0] || {})}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)} disabled={sending}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                <SendIcon size={16} />
                {sending ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------- DETAIL MODAL */}
      {(detail || loadingDetail) && (
        <div className="modal-overlay" onClick={() => !loadingDetail && setDetail(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Message detail</h2>
              <button className="modal-close" onClick={() => setDetail(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {loadingDetail || !detail ? (
                <div className="skeleton" style={{ height: '160px' }} />
              ) : (
                <>
                  <div className="blast-confirm-preview" style={{ marginBottom: '16px' }}>
                    {detail.message}
                  </div>
                  <div className="blast-confirm-stats">
                    <div><span>Sent</span><strong>{detail.sent_count}</strong></div>
                    <div><span>Failed</span><strong>{detail.failed_count}</strong></div>
                    <div><span>Skipped</span><strong>{detail.skipped_count}</strong></div>
                    <div><span>Sent by</span><strong>{detail.sender_name || '—'}</strong></div>
                  </div>
                  <div className="table-container" style={{ marginTop: '16px' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Number</th>
                          <th>Status</th>
                          <th className="mobile-hide">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail.recipients || []).map((r) => (
                          <tr key={r.id}>
                            <td style={{ color: 'var(--text-primary)' }}>{r.member_name || '—'}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{r.phone_number || '—'}</td>
                            <td>
                              <span className={`badge badge-${r.status}`}>
                                {STATUS_LABELS[r.status] || r.status}
                              </span>
                            </td>
                            <td className="mobile-hide" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {r.error || r.provider_sid || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
