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
// Other flags:
//
//        --incognito   open a private Chrome/Edge window (fixes Google's
//                      "the request is malformed" 400 when several Google
//                      accounts are signed in to the default profile)
//        --no-open     print the URL only, do not launch a browser
//        --port=NNNNN  use a different loopback port
//
// Node's global fetch means there is nothing to install.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import readline from 'node:readline'
import { execFile } from 'node:child_process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const args = process.argv.slice(2)
const manual = args.includes('--manual') || args.includes('-m')
const noOpen = args.includes('--no-open')
const incognito = args.includes('--incognito') || args.includes('-i')
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
 * Locate a Chromium browser so `--incognito` can open a clean profile.
 *
 * Google's generic
 *
 *     Error 400. That's an error.
 *     The server cannot process the request because it is malformed.
 *
 * page is produced by the browser session — several Google accounts, stale
 * Google cookies, or an extension rewriting the URL — not by the URL itself.
 * A fresh private window with one account avoids all three.
 */
function findChromiumBrowser() {
  const candidates = []

  if (process.platform === 'win32') {
    for (const root of [
      process.env['ProgramFiles'],
      process.env['ProgramFiles(x86)'],
      process.env['LocalAppData'],
    ]) {
      if (!root) continue
      candidates.push(
        { file: path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'), flag: '--incognito' },
        {
          file: path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          flag: '--inprivate',
        }
      )
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      {
        file: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        flag: '--incognito',
      },
      {
        file: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        flag: '--inprivate',
      }
    )
  } else {
    candidates.push(
      { file: '/usr/bin/google-chrome', flag: '--incognito' },
      { file: '/usr/bin/microsoft-edge', flag: '--inprivate' },
      { file: '/usr/bin/chromium', flag: '--incognito' },
      { file: '/usr/bin/chromium-browser', flag: '--incognito' }
    )
  }

  return candidates.find(entry => fs.existsSync(entry.file)) || null
}

/**
 * Hand the URL to a browser.
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
function openBrowser(url, { useIncognito = false } = {}) {
  if (useIncognito) {
    const browser = findChromiumBrowser()
    if (!browser) {
      console.log(
        '\nCould not find Chrome or Edge for --incognito. Opening the default browser instead.\n' +
          'Open the URL above in a private window yourself if it fails.\n'
      )
    } else {
      execFile(browser.file, [browser.flag, url], err => {
        if (err) {
          console.log('\nCould not open the private window — copy the URL above instead.\n')
        }
      })
      console.log(`Opening ${path.basename(browser.file)} in a private window.\n`)
      return
    }
  }

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

/**
 * Ask Google whether it accepts the URL before the browser gets involved.
 *
 * A valid authorization URL always answers 302 with a Location pointing at the
 * accounts.google.com sign-in page. A 400 here means the link really is broken
 * (bad client id, truncated scope, redirect not allowed) — which is worth
 * distinguishing from the browser-side 400 described above.
 */
async function preflightAuthUrl(url) {
  console.log('Checking the authorization URL with Google…')
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    if (res.status === 302 || res.status === 301 || res.status === 303) {
      const location = res.headers.get('location') || ''
      if (/accounts\.google\.com/.test(location)) {
        console.log('  ✔ Google accepts the link (it redirects to the sign-in page).\n')
        return true
      }
      console.log(`  ! Unexpected redirect: ${location.slice(0, 140)}\n`)
      return false
    }

    if (res.status === 400) {
      const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 300)
      console.log('  ✖ Google rejected the link as malformed (HTTP 400).')
      console.log(`    ${body || '(no detail)'}\n`)
      console.log('  Check that GMAIL_CLIENT_ID belongs to a "Desktop app" OAuth client')
      console.log('  and that the Google APIs are enabled in the same project.\n')
      return false
    }

    console.log(`  ! Google answered HTTP ${res.status}. Continuing anyway.\n`)
    return true
  } catch (err) {
    console.log(`  ! Could not reach Google (${err.message}). Continuing anyway.\n`)
    return true
  }
}

function explainOAuthError(error) {
  switch (error) {
    case 'access_denied':
      return (
        'Google returned access_denied — the consent was declined, or the account is\n' +
        'not allowed to use this OAuth client.\n' +
        '  · Sign in as the Workspace account that owns the project.\n' +
        '  · If the consent screen user type is "Internal", only accounts in that\n' +
        '    Workspace can authorize; a personal Gmail address cannot.\n' +
        '  · Run with --incognito so the right account is the only one signed in.'
      )
    case 'org_internal':
      return (
        'Google refused because the OAuth consent screen is Internal and this\n' +
        'account is outside the Workspace organization. Sign in with the church\n' +
        'Workspace account (e.g. uccpsukat@seca.edu.ph).'
      )
    case 'redirect_uri_mismatch':
      return (
        'Google returned redirect_uri_mismatch. The OAuth client is a "Web\n' +
        'application" — create (or switch to) a "Desktop app" client, which allows\n' +
        `the loopback redirect ${REDIRECT_URI}.`
      )
    case 'invalid_client':
      return (
        'Google returned invalid_client. GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET do\n' +
        'not match an existing OAuth client, or that client was deleted.'
      )
    case 'admin_policy_enforced':
      return (
        'Google Workspace blocked the request by admin policy. A Workspace admin\n' +
        'must allow the Gmail, Sheets and Drive scopes for this OAuth client.'
      )
    default:
      return `Google returned: ${error}\nRun again with --incognito, or check the OAuth client settings.`
  }
}

function printMalformedHint() {
  console.log('\nIf Google shows “The server cannot process the request because it is')
  console.log('malformed”, the link is fine — the browser session is not. Open it in a')
  console.log('private window with only the church account:\n')
  console.log('  npm run google-auth -- --incognito\n')
  console.log('That avoids several signed-in Google accounts, stale Google cookies and')
  console.log('extensions rewriting the URL. If it still fails, sign out of every')
  console.log('Google account in the browser, or paste the printed URL into a private')
  console.log('window yourself (npm run google-auth -- --no-open).\n')
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
  // Keep whatever EMAIL_FROM is already configured: it must be an address this
  // mailbox is allowed to send as, and the placeholder below is not.
  console.log(
    `EMAIL_FROM="${process.env.EMAIL_FROM || 'The Family Sync <mailbox@your-domain.example>'}"`
  )
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

  await preflightAuthUrl(authUrl)

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
  printMalformedHint()

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
    fail(explainOAuthError(error))
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

server.listen(PORT, '127.0.0.1', async () => {
  console.log('\nOpen this URL, sign in with the sending mailbox, and approve access:\n')
  console.log(authUrl + '\n')
  console.log(`Waiting for the redirect on ${REDIRECT_URI} …`)
  console.log('(If the browser does not open, copy the URL above. If the redirect never')
  console.log(' arrives, press Ctrl+C and run: npm run google-auth -- --manual)\n')

  const ok = await preflightAuthUrl(authUrl)
  if (!ok) {
    server.close()
    fail('Google will not accept that authorization link. Fix the setup and run again.')
    process.exit(1)
  }

  printMalformedHint()

  if (noOpen) {
    console.log('--no-open: the URL above is yours to paste into a private window.\n')
    return
  }

  openBrowser(authUrl, { useIncognito: incognito })
})
