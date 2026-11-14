import { NextResponse } from 'next/server'
import { oid } from '@/lib/db'
import { authUser } from '@/lib/auth'
import { getMemberImage } from '@/lib/images'

// Serves profile photos from the images cluster. The member API only returns a
// short /api/images/<id> URL; the bytes never enter member documents.
export async function GET(request, { params }) {
  try {
    const user = await authUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!oid(id)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const image = await getMemberImage(id)
    if (!image?.data) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const bytes = Buffer.from(image.data, 'base64')

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': image.mime_type || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        // Private: photos are behind the session cookie. `v` in the URL busts
        // the cache after an upload.
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('image serve error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
