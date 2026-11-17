import { NextResponse } from 'next/server'
import { modelsFor } from '@/lib/models'
import { authUser } from '@/lib/auth'
import { serializeMember } from '@/lib/serialize'
import { memberExportMatrix, memberExportTitle } from '@/lib/member-export'
import { googleAccessToken, googleRequest } from '@/lib/google-auth'

// =============================================
// GOOGLE SHEETS EXPORT
//
// Builds a spreadsheet in the authorized Workspace mailbox's Drive, fills it
// with the masterlist, and shares it with the administrator who asked, then
// hands back the link. The browser never talks to Google, so no token ever
// reaches the client.
//
// Setup lives in the README (Email → Google Sheets export): the Sheets and
// Drive APIs enabled on the same project, and a refresh token minted by
// `npm run google-auth` that includes the spreadsheets + drive.file scopes.
// =============================================

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'

export const dynamic = 'force-dynamic'

function setupResponse(err) {
  const message = String(err.message || 'Google Sheets export failed')
  const reason = err.reason || ''

  if (reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' || /insufficient.*scopes?/i.test(message)) {
    return NextResponse.json(
      {
        error:
          'The Google account has not approved the Sheets export yet. Run `npm run google-auth` (it asks for the Sheets and Drive scopes), paste the new GMAIL_REFRESH_TOKEN into Vercel, and try again.',
      },
      { status: 503 }
    )
  }

  if (reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(message)) {
    const name = err.service ? err.service.replace('.googleapis.com', '') : 'Google Sheets'
    return NextResponse.json(
      {
        error: `The ${name} API is not enabled for this Google Cloud project. Enable it under APIs & Services → Library, then try again.`,
      },
      { status: 503 }
    )
  }

  if (/not configured|invalid_grant|authorization expired/i.test(message)) {
    return NextResponse.json({ error: message }, { status: 503 })
  }

  return NextResponse.json({ error: message }, { status: 502 })
}

export async function POST(request) {
  try {
    const user = await authUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { Member } = await modelsFor('members')

    // Same order as the members page, so the sheet matches what was on screen.
    const members = await Member.find({})
      .collation({ locale: 'en', strength: 2 })
      .sort({ last_name: 1, first_name: 1 })
      .lean()

    if (!members.length) {
      return NextResponse.json({ error: 'There are no members to export yet.' }, { status: 400 })
    }

    const values = memberExportMatrix(members.map(serializeMember))
    const title = memberExportTitle()
    const token = await googleAccessToken()

    const created = await googleRequest(SHEETS_API, {
      token,
      method: 'POST',
      body: JSON.stringify({
        properties: { title },
        sheets: [
          {
            properties: {
              title: 'Members',
              gridProperties: {
                rowCount: values.length,
                columnCount: values[0].length,
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    })

    const spreadsheetId = created.spreadsheetId
    if (!spreadsheetId) throw new Error('Google did not return a spreadsheet id.')

    await googleRequest(
      `${SHEETS_API}/${spreadsheetId}/values/Members!A1?valueInputOption=RAW`,
      {
        token,
        method: 'PUT',
        body: JSON.stringify({ range: 'Members!A1', majorDimension: 'ROWS', values }),
      }
    )

    // The file is owned by the Workspace mailbox, so the administrator who
    // clicked the button needs an explicit grant to open it. A failure here
    // only affects that convenience, never the export itself.
    let shared = false
    if (user.email) {
      try {
        await googleRequest(`${DRIVE_FILES}/${spreadsheetId}/permissions?sendNotificationEmail=false`, {
          token,
          method: 'POST',
          body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: user.email }),
        })
        shared = true
      } catch (err) {
        console.error('sheets share error:', err.message)
      }
    }

    return NextResponse.json({
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      title,
      rows: members.length,
      shared,
    })
  } catch (err) {
    console.error('sheets export error:', err)
    return setupResponse(err)
  }
}
