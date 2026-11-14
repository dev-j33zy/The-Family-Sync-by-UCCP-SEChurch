import { NextResponse } from 'next/server'
import { authUser } from '@/lib/auth'
import { getEventsPayload } from '@/lib/events'

// Session-authenticated events endpoint for the desktop widget. The widget
// signs in with a normal Family Sync account, so no shared key or database
// credential is needed on the client.
export async function GET(request) {
  const user = await authUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await getEventsPayload())
  } catch (err) {
    console.error('widget events error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
