import { oid } from './db.js'
import { modelsFor } from './models/index.js'

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is

/** Split a `data:image/png;base64,...` string into its parts, or null. */
export function parseImageDataUrl(value) {
  if (typeof value !== 'string') return null
  const match = value.match(DATA_URL_RE)
  if (!match) return null
  return { mime_type: match[1].toLowerCase(), data: match[2].replace(/\s/g, '') }
}

export async function saveMemberImage(memberId, dataUrl) {
  const parsed = parseImageDataUrl(dataUrl)
  const id = oid(memberId)
  if (!parsed || !id) return false

  const { Image } = await modelsFor('images')
  await Image.updateOne(
    { member_id: id },
    {
      $set: {
        mime_type: parsed.mime_type,
        data: parsed.data,
        byte_size: Math.floor((parsed.data.length * 3) / 4),
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
