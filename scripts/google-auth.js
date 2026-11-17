// Mint the Google API refresh token used by lib/google-auth.js (email + the
// Google Sheets export).
//
//   1. Google Cloud Console → new project (or reuse one) → APIs & Services →
//      Library → enable "Gmail API", "Google Sheets API" and "Google Drive API".
//   2. OAuth consent screen → User type: Internal (Workspace only), publish it.
//   3. Credentials → Create credentials → OAuth client ID → Desktop app.
//   4. Put the client id/secret in .env.local as GMAIL_CLIENT_ID and
//      GMAIL_CLIENT_SECRET, then run:
//
//        npm run google-auth
//
// Sign in with the mailbox that should send the mail and own the exported
// sheets, approve the scopes, and paste the printed GMAIL_REFRESH_TOKEN into
// .env.local and Vercel.
//
// If the browser cannot complete the loopback redirect (firewall, remote
// desktop, browser on another machine), run it with --manual instead:
//
//        npm run google-auth -- --manual
//
// Node's global fetch means there is nothing to install.

import http from 'node:http'
import crypto from 'node:crypto'
import readline from 'node:readline'
import { execFile } from 'node:child_process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const args = process.argv.slice(2)
const manual = args.includes('--manual') || args.includes('-m')
const portFlag = args.find(a => a.startsWith('--port='))

const PORT = Number(
  (portFlag ? portFlag.split('=')[1] : null) || process.env.GMAIL_OAUTH_PORT || 53682
)
const REDIRECT_URI = `http://127.0.0.1:${PORT}`
// The token carries every scope the app needs, so one consent covers both
// features. Re-running the script is also how an older Gmail-only token is
// upgraded after the Sheets export was added.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
]

const REQUIRED_SCOPES = [
  ['gmail.send', 'Gmail API (invites and password resets)'],
  ['spreadsheets', 'Google Sheets export'],
  ['drive.file', 'sharing exported sheets with the signed-in administrator'],
]

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

const clientId = process.env.GMAIL_CLIENT_ID
const clientSecret = process.env.GMAIL_CLIENT_SECRET

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exitCode = 1
}

if (!clientId || !clientSecret) {
  fail(
    'GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env.local.\n' +
      'Create an OAuth client (Desktop app) in Google Cloud Console first.'
  )
  process.exit(1)
}

/**
 * Hand the URL to the default browser.
 *
 * Do NOT go through `cmd /c start` here. cmd.exe treats `&` as a command
 * separator and `%` as a variable marker, and Node only quotes arguments that
 * contain whitespace — so the browser used to receive the URL truncated at the
 * first `&`, i.e. only `?client_id=...`. Google answers that with
 *
 *     Error 400: invalid_request
 *     Request details: flowName=GeneralOAuthFlow
 *
 * because response_type, redirect_uri and scope never arrived. The launchers
 * below receive the URL as an ordinary process argument, so shell metacharacters
 * stay inside the URL.
 */
function openBrowser(url) {
  const [file, fileArgs] =
    process.platform === 'win32'
      ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]

  execFile(file, fileArgs, err => {
    if (err) {
      console.log('\nCould not open a browser automatically — open the URL above by hand.\n')
    }
  })
}

function decodeIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1]
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

async function listSendAs(accessToken) {
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.sendAs || []
  } catch {
    return []
  }
}

function buildAuthUrl(state) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    // Force a fresh consent so Google issues a refresh token every time, even
    // when this mailbox authorized the app before.
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString()
  return url.toString()
}

// A truncated or hand-edited URL is the most common way this flow breaks, so
// refuse to open something Google will only reject.
function assertCompleteAuthUrl(url) {
  const params = new URL(url).searchParams
  const missing = ['client_id', 'redirect_uri', 'response_type', 'scope'].filter(
    key => !params.get(key)
  )
  if (missing.length) {
    throw new Error(`Authorization URL is missing ${missing.join(', ')}`)
  }
}

function extractCode(input) {
  const text = String(input || '').trim()
  if (!text) return null
  if (/^https?:/i.test(text)) {
    try {
      return new URL(text).searchParams.get('code')
    } catch {
      return null
    }
  }
  const match = /[?&]country=[^&\s]*&?code=([^&\s]+)/.exec(text) || /[?&]?code=([^&\s]+)/.exec(text)
  return match ? decodeURIComponent(match[1]) : text
}

async function exchangeCode(code) {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  return { tokenRes, tokens: await tokenRes.json().catch(() => ({})) }
}

async function report(tokens) {
  const profile = tokens.id_token ? decodeIdToken(tokens.id_token) : null
  const sendAs = await listSendAs(tokens.access_token)
  const granted = String(tokens.scope || '')
  const missing = REQUIRED_SCOPES.filter(([scope]) => !granted.split(/\s+/).some(s => s.endsWith(`/${scope}`)))

  console.log('\n✔ Authorized' + (profile?.email ? ` as ${profile.email}` : '') + '\n')
  console.log('Add these to .env.local AND to the Vercel project (Production):\n')
  console.log(`GMAIL_CLIENT_ID=${clientId}`)
  console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`)
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
  console.log('EMAIL_FROM="The Family Sync <no-reply@your-domain.example>"')
  console.log(
    `NEXT_PUBLIC_APP_URL=${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}`
  )

  if (missing.length) {
    console.log('\n! Google did not grant:')
    for (const [scope, purpose] of missing) {
      console.log(`    ${scope} — ${purpose}`)
    }
    console.log('  Features that need them will report a setup error until a new')
    console.log('  consent includes them. Run this script again and approve everything.')
  } else {
    console.log('\n✔ Scopes granted: Gmail send, Sheets, Drive (files this app creates).')
  }

  console.log('\nReminder: enable the Gmail API, Google Sheets API and Google Drive API')
  console.log('in the same Google Cloud project, or the first export will be refused.')

  if (sendAs.length) {
    console.log('\nAddresses this mailbox may send as:')
    for (const entry of sendAs) {
      const flag = entry.verificationStatus === 'accepted' ? '✔' : '…'
      console.log(`  ${flag} ${entry.sendAsEmail} (${entry.verificationStatus})`)
    }
    console.log('\nEMAIL_FROM must be the primary address or one marked ✔.')
    console.log('Add a new address in Gmail → Settings → Accounts → "Send mail as".')
  }

  console.log('')
}

/** Validate the token response, then print what the app needs. */
async function finish(tokenRes, tokens) {
  if (!tokenRes.ok || !tokens.refresh_token) {
    if (!tokens.refresh_token && tokens.access_token) {
      fail(
        'Google did not return a refresh token. Remove the app’s access at ' +
          'https://myaccount.google.com/permissions and run the script again.'
      )
    } else {
      fail(`Token exchange failed: ${tokens.error_description || tokens.error || tokenRes.status}`)
    }
    return false
  }

  await report(tokens)
  return true
}

if (manual) {
  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = buildAuthUrl(state)

  try {
    assertCompleteAuthUrl(authUrl)
  } catch (err) {
    fail(err.message)
    process.exit(1)
  }

  console.log('\n1. Open this URL and sign in with the sending mailbox:\n')
  console.log(authUrl + '\n')
  console.log('2. Approve every requested permission (Gmail, Sheets, Drive).')
  console.log(
    '   Nothing is listening on the loopback port, so the browser will end on a\n' +
      '   "site can’t be reached" page (http://127.0.0.1:' +
      PORT +
      '/?code=...). That is\n' +
      '   expected — the address bar still holds the authorization code.\n'
  )
  console.log('3. Copy the whole address from the address bar and paste it below.\n')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise(resolve => rl.question('Paste the redirect URL: ', resolve))
  rl.close()

  const code = extractCode(answer)
  if (!code) {
    fail('No authorization code found in that input.')
    process.exit(1)
  }

  const { tokenRes, tokens } = await exchangeCode(code)
  const ok = await finish(tokenRes, tokens)
  console.log(ok ? 'Done.' : '')
  process.exit(ok ? 0 : 1)
}

const state = crypto.randomBytes(16).toString('hex')
const authUrl = buildAuthUrl(state)

try {
  assertCompleteAuthUrl(authUrl)
} catch (err) {
  fail(err.message)
  process.exit(1)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI)
  if (url.pathname !== '/') {
    res.writeHead(404).end()
    return
  }

  const error = url.searchParams.get('error')
  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Authorization cancelled. You can close this tab.')
    server.close()
    fail(`Google returned: ${error}`)
    return
  }

  if (url.searchParams.get('state') !== state) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('State mismatch. You can close this tab.')
    server.close()
    fail('The OAuth state did not match. Run the script again.')
    return
  }

  const code = url.searchParams.get('code')
  if (!code) {
    res.writeHead(400).end()
    server.close()
    fail('Google did not return an authorization code.')
    return
  }

  try {
    const { tokenRes, tokens } = await exchangeCode(code)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(
      '<h2>Authorized.</h2><p>Return to the terminal for the refresh token. You can close this tab.</p>'
    )
    server.close()

    await finish(tokenRes, tokens)
  } catch (err) {
    res.writeHead(500).end()
    server.close()
    fail(err.message)
  }
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    fail(
      `Port ${PORT} is already in use. Run again with another port:\n` +
        `  npm run google-auth -- --port=${PORT + 1}\n` +
        'or use --manual, which does not need to listen at all.'
    )
    return
  }
  fail(`Could not listen on ${REDIRECT_URI}: ${err.message}`)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nOpen this URL, sign in with the sending mailbox, and approve access:\n')
  console.log(authUrl + '\n')
  console.log(`Waiting for the redirect on ${REDIRECT_URI} …`)
  console.log('(If the browser does not open, copy the URL above. If the redirect never')
  console.log(' arrives, press Ctrl+C and run: npm run google-auth -- --manual)\n')
  openBrowser(authUrl)
})
