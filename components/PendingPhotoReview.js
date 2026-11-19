'use client'
import { useEffect, useState } from 'react'

// Staff-only queue for photos proposed by public registrants whose details
// matched an existing member. Pass `memberId` to limit it to one member.
export default function PendingPhotoReview({ memberId }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const query = memberId ? `?member_id=${encodeURIComponent(memberId)}` : ''
        const res = await fetch(`/api/photos/pending${query}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Could not load pending photos')
        const data = await res.json()
        if (active) setPhotos(Array.isArray(data) ? data : [])
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [memberId])

  async function decide(photo, action) {
    setBusy(photo.id)
    setError('')
    try {
      const res = await fetch(`/api/photos/pending/${photo.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not review the photo')
      }
      setPhotos(prev => prev.filter(item => item.id !== photo.id))
    } catch (err) {
      setError(err.message)
    }
    setBusy('')
  }

  if (loading || photos.length === 0) return null

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title" style={{ margin: 0 }}>Photo Review</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {photos.length} pending
        </span>
      </div>
      <div className="card-body">
        {error && <div className="settings-alert error" style={{ marginBottom: '12px' }}>{error}</div>}
        <div style={{ display: 'grid', gap: '12px' }}>
          {photos.map(photo => (
            <div key={photo.id} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '12px', background: 'var(--bg-input)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            }}>
              <img src={`/api/photos/pending/${photo.id}`} alt="Proposed profile"
                style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {photo.member_name || photo.submitted_name || 'Member'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {photo.submitted_email || 'Submitted through public registration'}
                </div>
                {photo.created_at && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(photo.created_at).toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button className="btn btn-primary btn-sm" disabled={busy === photo.id}
                  onClick={() => decide(photo, 'approve')}>Approve</button>
                <button className="btn btn-ghost btn-sm" disabled={busy === photo.id}
                  onClick={() => decide(photo, 'reject')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
