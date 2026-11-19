'use client'
import { useState, useEffect, useRef } from 'react'

// The members API caps the JSON body at 128 KB (app/api/members/route.js).
// Base64 inflates image bytes by ~33%, so target the data-URL string itself and
// leave headroom for the other form fields and JSON syntax.
export const PHOTO_DATA_URL_TARGET = 96 * 1024

function encodeJpeg(img, width, height, quality) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Shrink a data-URL image until the resulting string fits `targetBytes`,
 * whatever the source resolution. JPEG quality is lowered first (keeps the
 * crop crisp), then pixel dimensions, with a tiny guaranteed fallback so the
 * promise always resolves under the target.
 */
export function compressPhoto(dataUrl, targetBytes = PHOTO_DATA_URL_TARGET) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let width = img.naturalWidth || 1
      let height = img.naturalHeight || 1

      for (const quality of [0.92, 0.82, 0.72, 0.62, 0.52, 0.42, 0.32]) {
        const result = encodeJpeg(img, width, height, quality)
        if (result.length <= targetBytes) return resolve(result)
      }

      for (let i = 0; i < 12; i++) {
        width = Math.max(1, Math.round(width * 0.8))
        height = Math.max(1, Math.round(height * 0.8))
        const result = encodeJpeg(img, width, height, 0.6)
        if (result.length <= targetBytes) return resolve(result)
      }

      // Always meet the target, even for a pathological source image.
      resolve(encodeJpeg(img, 16, 16, 0.5))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export default function PhotoCropper({ imageSrc, onCrop, onCancel }) {
  const containerRef = useRef(null)
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, size: 0 })
  const [saving, setSaving] = useState(false)
  const [containerSize, setContainerSize] = useState({ w: 500, h: 500 })

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

  // Measure the image area actually rendered on screen. The dark overlay and
  // the crop box must share one pixel scale or they drift apart on small
  // screens (where the modal's available width changes).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure)
      observer.observe(el)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const scale = imgNatural.w && containerSize.w ? containerSize.w / imgNatural.w : 1

  function constrain(v, min, max) { return Math.max(min, Math.min(max, v)) }

  const MIN_SIZE = 50
  // Corner handles may be dragged past the image edges so the crop can include
  // the outermost edge/corner pixels (or fully cover a non-square image). Cap
  // the size and require a small overlap so a crop can never be entirely blank.
  const MAX_SIZE = imgNatural.w ? Math.round(Math.max(imgNatural.w, imgNatural.h) * 2) : 1

  function clampSize(s) {
    return Math.round(constrain(s, MIN_SIZE, MAX_SIZE))
  }

  function clampAxis(v, min, max) {
    return max <= min ? min : constrain(v, min, max)
  }

  function clampPosition(x, y, size) {
    return {
      x: clampAxis(x, -(size - MIN_SIZE), imgNatural.w - MIN_SIZE),
      y: clampAxis(y, -(size - MIN_SIZE), imgNatural.h - MIN_SIZE),
      size,
    }
  }

  function makeCornerDragHandler(corner, e) {
    const startX = e.clientX, startY = e.clientY
    const { x, y, size } = cropRect

    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale

      // The opposite corner stays anchored; the dragged corner follows the
      // pointer and is allowed to go outside the image borders.
      const left = x, top = y, right = x + size, bottom = y + size
      let newX = left, newY = top, newSize = size

      switch (corner) {
        case 'se': {
          newSize = clampSize(Math.min(right + dx - left, bottom + dy - top))
          break
        }
        case 'ne': {
          newSize = clampSize(Math.min(right + dx - left, bottom - (top + dy)))
          newY = bottom - newSize
          break
        }
        case 'sw': {
          newSize = clampSize(Math.min(right - (left + dx), bottom + dy - top))
          newX = right - newSize
          break
        }
        case 'nw': {
          newSize = clampSize(Math.min(right - (left + dx), bottom - (top + dy)))
          newX = right - newSize
          newY = bottom - newSize
          break
        }
      }
      setCropRect(clampPosition(newX, newY, newSize))
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

    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      setCropRect(clampPosition(x + dx, y + dy, size))
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
    return clampPosition(cx - s / 2, cy - s / 2, s)
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
    // Any part of the square that falls past an image edge becomes white
    // padding instead of a black bar.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size, size)

    const img = new Image()
    img.onload = async () => {
      ctx.drawImage(img, x, y, size, size, 0, 0, size, size)
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const compressed = await compressPhoto(rawDataUrl)
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
            Drag the square or its corner handles to select the crop area — handles may extend past the image edges
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
                      setCropRect(clampPosition(snapped.x + dx, snapped.y + dy, snapped.size))
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
                  viewBox={`0 0 ${containerSize.w} ${containerSize.h}`}
                  preserveAspectRatio="none"
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
