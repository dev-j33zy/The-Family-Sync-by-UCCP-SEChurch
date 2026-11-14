import { NextResponse } from 'next/server'
import { destroySession, tokenFromRequest, clearSessionCookie } from '@/lib/auth'

export async function POST(request) {
  try {
    const token = tokenFromRequest(request)
    if (token) await destroySession(token)
    const response = NextResponse.json({ ok: true })
    return clearSessionCookie(response)
  } catch (err) {
    console.error('logout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}