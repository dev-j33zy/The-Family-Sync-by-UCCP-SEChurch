'use client'
import { useState, useEffect, useRef } from 'react'

export function compressUnder1MB(dataUrl) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight
      let quality = 0.92
      let result = dataUrl
      for (let attempt = 0; attempt < 8; attempt++) {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        result = canvas.toDataURL('image/jpeg', quality)
        if (result.length < 1_000_000) break
        quality -= 0.12
        w = Math.round(w * 0.85)
        h = Math.round(h * 0.85)
      }
      resolve(result)
    }
    img.src = dataUrl
  })
}

export default function PhotoCropper({ imageSrc, onCrop, onCancel }) {
  const containerRef = useRef(null)
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, size: 0 })
  const [saving, setSaving] = useState(false)
  const [containerW, setContainerW] = useState(500)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const w = img.width, h = img.height
      setImgNatural({ w, h })
      const maxSize = Math.min(w, h)
      const initSize = Math.round(maxSize * 0.8)
      setCropRect({
        x: (w - initSize) / 2,
        y: (h - initSize) / 2,
        size: initSize,
      })
    }
    img.src = imageSrc
  }, [imageSrc])

  useEffect(() => {
    if (!containerRef.current) return
    const resize = () => setContainerW(Math.min(containerRef.current.clientWidth, 500))
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const scale = imgNatural.w ? containerW / imgNatural.w : 1
  const displayH = imgNatural.w ? Math.round(containerW * (imgNatural.h / imgNatural.w)) : containerW

  function constrain(v, min, max) { return Math.max(min, Math.min(max, v)) }

  const MIN_SIZE = 50

  function makeCornerDragHandler(corner, e) {
    const startX = e.clientX, startY = e.clientY
    const { x, y, size } = cropRect

    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      const { w, h } = imgNatural

      let newX = x, newY = y, newSize = size
      const fixedRight = x + size, fixedBottom = y + size

      switch (corner) {
        case 'se': {
          const mx = fixedRight + dx
          const my = fixedBottom + dy
          const s = Math.max(MIN_SIZE, Math.min(mx - x, my - y, w - x, h - y))
          newSize = Math.round(s)
          break
        }
        case 'ne': {
          const mx = fixedRight + dx
          const my = y + dy
          const s = Math.max(MIN_SIZE, Math.min(mx - x, fixedBottom - my, w - x, fixedBottom))
          newSize = Math.round(s)
          newY = fixedBottom - newSize
          break
        }
        case 'sw': {
          const mx = x + dx
          const my = fixedBottom + dy
          const s = Math.max(MIN_SIZE, Math.min(fixedRight - mx, my - y, fixedRight, h - y))
          newSize = Math.round(s)
          newX = fixedRight - newSize
          break
        }
        case 'nw': {
          const mx = x + dx
          const my = y + dy
          const s = Math.max(MIN_SIZE, Math.min(fixedRight - mx, fixedBottom - my, fixedRight, fixedBottom))
          newSize = Math.round(s)
          newX = fixedRight - newSize
          newY = fixedBottom - newSize
          break
        }
      }
      setCropRect({ x: newX, y: newY, size: newSize })
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function makeMoveHandler(e) {
    const startX = e.clientX, startY = e.clientY
    const { x, y, size } = cropRect
    const { w, h } = imgNatural

    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      setCropRect({
        x: constrain(x + dx, 0, w - size),
        y: constrain(y + dy, 0, h - size),
        size,
      })
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function snapToClient(e) {
    const rect = containerRef.current.getBoundingClientRect()
    const cx = (e.clientX - rect.left) / scale
    const cy = (e.clientY - rect.top) / scale
    const s = cropRect.size
    return {
      x: constrain(cx - s / 2, 0, imgNatural.w - s),
      y: constrain(cy - s / 2, 0, imgNatural.h - s),
    }
  }

  async function handleCrop() {
    setSaving(true)
    const { w, h } = imgNatural
    if (!w || !h) return
    const { x, y, size } = cropRect
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.onload = async () => {
      ctx.drawImage(img, x, y, size, size, 0, 0, size, size)
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const compressed = await compressUnder1MB(rawDataUrl)
      onCrop(compressed)
    }
    img.src = imageSrc
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Crop Photo</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Drag the square to select the crop area
          </p>
          <div ref={containerRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
            {imgNatural.w ? (
              <>
                <img src={imageSrc} alt="Photo" draggable={false}
                  style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-sm)', pointerEvents: 'none' }} />

                <div
                  style={{ position: 'absolute', inset: 0, cursor: saving ? 'default' : 'crosshair', borderRadius: 'var(--radius-sm)' }}
                  onPointerDown={e => {
                    if (saving) return
                    const snap = snapToClient(e)
                    setCropRect(prev => ({ ...snap, size: prev.size }))
                    const startX = e.clientX, startY = e.clientY
                    const snapped = { ...snap, size: cropRect.size }
                    function onMove(ev) {
                      const dx = (ev.clientX - startX) / scale
                      const dy = (ev.clientY - startY) / scale
                      setCropRect({
                        x: constrain(snapped.x + dx, 0, imgNatural.w - snapped.size),
                        y: constrain(snapped.y + dy, 0, imgNatural.h - snapped.size),
                        size: snapped.size,
                      })
                    }
                    function onUp() {
                      window.removeEventListener('pointermove', onMove)
                      window.removeEventListener('pointerup', onUp)
                    }
                    window.addEventListener('pointermove', onMove)
                    window.addEventListener('pointerup', onUp)
                  }}
                />

                <svg
                  viewBox={`0 0 ${containerW} ${displayH}`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 'var(--radius-sm)' }}
                >
                  <defs>
                    <mask id="cropMask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect x={cropRect.x * scale} y={cropRect.y * scale}
                        width={cropRect.size * scale} height={cropRect.size * scale} fill="black" />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#cropMask)" />
                </svg>

                <div
                  style={{
                    position: 'absolute', left: cropRect.x * scale, top: cropRect.y * scale,
                    width: cropRect.size * scale, height: cropRect.size * scale,
                    border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                    borderRadius: '2px', cursor: saving ? 'default' : 'grab',
                    pointerEvents: 'auto', touchAction: 'none',
                  }}
                  onPointerDown={e => { if (!saving) makeMoveHandler(e) }}
                >
                  {(['nw', 'ne', 'sw', 'se']).map(corner => {
                    const hStyle = {
                      position: 'absolute', width: '14px', height: '14px',
                      border: '2px solid #fff', borderRadius: '2px',
                      background: 'var(--primary)', zIndex: 2,
                      touchAction: 'none',
                    }
                    const cursorMap = { nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize' }
                    const posMap = {
                      nw: { top: '-7px', left: '-7px' },
                      ne: { top: '-7px', right: '-7px' },
                      sw: { bottom: '-7px', left: '-7px' },
                      se: { bottom: '-7px', right: '-7px' },
                    }
                    Object.assign(hStyle, posMap[corner], { cursor: cursorMap[corner] })
                    return (
                      <div key={corner} style={hStyle}
                        onPointerDown={e => {
                          e.stopPropagation()
                          if (!saving) makeCornerDragHandler(corner, e)
                        }}
                      />
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="skeleton" style={{ width: '100%', paddingBottom: '75%', borderRadius: 'var(--radius-sm)' }} />
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCrop} disabled={!imgNatural.w || saving}>
            {saving ? 'Processing…' : 'Save Photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
