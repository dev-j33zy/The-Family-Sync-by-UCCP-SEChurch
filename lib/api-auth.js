import { NextResponse } from 'next/server'
import { authUser } from './auth.js'

/**
 * Route guards with one consistent contract:
 *
 *   const { user, response } = await requireAdmin(request)
 *   if (response) return response
 *
 * `response` is a ready-to-return 401/403 when access is denied, otherwise
 * null. Keeping the decision on the server matters: the role check that used
 * to live in the settings page was only a UI hint, not a security boundary.
 */

export async function requireUser(request) {
  const user = await authUser(request)
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { user, response: null }
}

/**
 * Admin-only guard. Every account in this deployment is an Administrator, but
 * the role is checked explicitly so a lower-privileged role added later cannot
 * silently inherit write access to members, sessions or other accounts.
 */
export async function requireAdmin(request) {
  const { user, response } = await requireUser(request)
  if (response) return { user: null, response }

  if (user.role !== 'Administrator') {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return { user, response: null }
}
