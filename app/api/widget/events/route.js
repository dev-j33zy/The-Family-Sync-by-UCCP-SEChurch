import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api-auth'
import { getEventsPayload } from '@/lib/events'

// Session-authenticated events endpoint for the desktop widget. The widget
// signs in with a normal Family Sync account, so no shared key or database
// credential is needed on the client.
export async function GET(request) {
  const { user, response } = await requireUser(request)
  if (response) return response

  try {
    return NextResponse.json(await getEventsPayload())
  } catch (err) {
    console.error('widget events error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
