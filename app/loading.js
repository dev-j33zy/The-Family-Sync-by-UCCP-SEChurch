// Shown immediately on client-side navigation while the next route's bundle
// streams in. Without this, the previous screen stays frozen until the new
// page is ready to render.
export default function Loading() {
  return (
    <div className="app-layout">
      <aside className="sidebar skeleton" aria-hidden="true" />
      <main className="main-content">
        <div className="page-wrapper">
          <div className="page-header">
            <div>
              <div className="skeleton" style={{ width: 190, height: 30, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 260, height: 12, borderRadius: 6, marginTop: 12 }} />
            </div>
          </div>
          <div className="stats-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="stat-card skeleton" style={{ height: 120 }} />
            ))}
          </div>
          <div className="card skeleton" style={{ height: '52vh', marginTop: 24 }} />
        </div>
      </main>
    </div>
  )
}
