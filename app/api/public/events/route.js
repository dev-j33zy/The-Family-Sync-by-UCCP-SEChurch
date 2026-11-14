import { NextResponse } from 'next/server'
import { getEventsPayload } from '@/lib/events'

// Key-protected endpoint kept for backwards compatibility with older widget
// builds and third-party clients. The current desktop widget uses the
// session-authenticated /api/widget/events instead.
export async function GET(request) {
  try {
    const key = request.headers.get('x-widget-key')
    const expected = process.env.WIDGET_API_KEY
    if (!expected || key !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(await getEventsPayload())
  } catch (err) {
    console.error('public events error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
