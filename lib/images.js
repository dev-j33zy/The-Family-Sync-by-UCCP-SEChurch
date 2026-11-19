import { oid } from './db.js'
import { modelsFor } from './models/index.js'

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is

// MongoDB documents are capped at 16 MB; base64 inflates bytes by ~33%, so
// keep uploads well under that (and under Vercel's request body limit).
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']

/** Split a `data:image/png;base64,...` string into its parts, or null. */
export function parseImageDataUrl(value) {
  if (typeof value !== 'string') return null
  const match = value.match(DATA_URL_RE)
  if (!match) return null
  return { mime_type: match[1].toLowerCase(), data: match[2].replace(/\s/g, '') }
}

/** Decoded size of a base64 payload, in bytes. */
export function imageByteSize(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

/**
 * Validate a new upload. Returns an error message, or null when the value is
 * acceptable (or is not an upload at all, e.g. the existing /api/images link).
 */
export function imageDataUrlError(value) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null
  const parsed = parseImageDataUrl(value)
  if (!parsed) return 'That photo could not be read. Use a PNG, JPEG, WebP, or GIF image.'
  if (!IMAGE_MIME_TYPES.includes(parsed.mime_type)) {
    return 'That photo type is not supported. Use a PNG, JPEG, WebP, or GIF image.'
  }
  if (imageByteSize(parsed.data) > MAX_IMAGE_BYTES) {
    return 'That photo is too large. Please choose one under 4 MB.'
  }
  return null
}

export async function saveMemberImage(memberId, dataUrl) {
  const parsed = parseImageDataUrl(dataUrl)
  const id = oid(memberId)
  if (!parsed || !id) return false
  if (!IMAGE_MIME_TYPES.includes(parsed.mime_type)) return false
  if (imageByteSize(parsed.data) > MAX_IMAGE_BYTES) return false

  const { Image } = await modelsFor('images')
  await Image.updateOne(
    { member_id: id },
    {
      $set: {
        mime_type: parsed.mime_type,
        data: parsed.data,
        byte_size: imageByteSize(parsed.data),
      },
    },
    { upsert: true }
  )
  return true
}

export async function deleteMemberImage(memberId) {
  const id = oid(memberId)
  if (!id) return
  const { Image } = await modelsFor('images')
  await Image.deleteOne({ member_id: id })
}

export async function getMemberImage(memberId) {
  const id = oid(memberId)
  if (!id) return null
  const { Image } = await modelsFor('images')
  return Image.findOne({ member_id: id }).lean()
}

// ---- Photos proposed by the public registration form but not applied until
// ---- staff reviews them. Kept in the images cluster, separate from Image.

export async function savePendingPhoto(memberId, dataUrl, meta = {}) {
  const parsed = parseImageDataUrl(dataUrl)
  const id = oid(memberId)
  if (!parsed || !id) return false
  if (!IMAGE_MIME_TYPES.includes(parsed.mime_type)) return false
  if (imageByteSize(parsed.data) > MAX_IMAGE_BYTES) return false

  const { PendingPhoto } = await modelsFor('images')
  await PendingPhoto.updateOne(
    { member_id: id },
    {
      $set: {
        mime_type: parsed.mime_type,
        data: parsed.data,
        byte_size: imageByteSize(parsed.data),
        submitted_name: String(meta.submitted_name || '').slice(0, 200),
        submitted_email: String(meta.submitted_email || '').slice(0, 254),
      },
    },
    { upsert: true }
  )
  return true
}

export async function listPendingPhotos(memberId) {
  const { PendingPhoto } = await modelsFor('images')
  const id = memberId && oid(memberId)
  const filter = id ? { member_id: id } : {}
  return PendingPhoto.find(filter)
    .select('member_id submitted_name submitted_email byte_size created_at updated_at')
    .sort({ created_at: -1 })
    .limit(100)
    .lean()
}

export async function getPendingPhoto(id) {
  const photoId = oid(id)
  if (!photoId) return null
  const { PendingPhoto } = await modelsFor('images')
  return PendingPhoto.findById(photoId).lean()
}

export async function deletePendingPhoto(id) {
  const photoId = oid(id)
  if (!photoId) return
  const { PendingPhoto } = await modelsFor('images')
  await PendingPhoto.deleteOne({ _id: photoId })
}

/**
 * Apply a `profile_picture` value that came from the client.
 *
 *   undefined  -> field not sent, leave the photo alone
 *   '' / null  -> remove the photo
 *   data: URL  -> store bytes in the images cluster
 *   /api/...   -> the form echoing back the current URL, leave it alone
 *
 * `Member` must be the members-cluster model (passed in to avoid a cycle).
 */
export async function applyMemberPhoto(memberId, photo, Member) {
  if (photo === undefined) return
  const id = oid(memberId)
  if (!id) return

  if (photo === null || photo === '') {
    await deleteMemberImage(id)
    await Member.updateOne({ _id: id }, { $set: { has_profile_picture: false } })
    return
  }

  // Only new uploads arrive as data URLs; anything else is an existing link.
  if (typeof photo !== 'string' || !photo.startsWith('data:')) return

  const saved = await saveMemberImage(id, photo)
  if (saved) {
    await Member.updateOne({ _id: id }, { $set: { has_profile_picture: true } })
  }
}
