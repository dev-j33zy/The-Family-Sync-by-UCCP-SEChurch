// Mint the Gmail API refresh token used by lib/email.js.
//
//   1. Google Cloud Console → new project (or reuse one) → enable "Gmail API".
//   2. OAuth consent screen → User type: Internal (Workspace only), publish it.
//   3. Credentials → Create credentials → OAuth client ID → Desktop app.
//   4. Put the client id/secret in .env.local as GMAIL_CLIENT_ID and
//      GMAIL_CLIENT_SECRET, then run:
//
//        node scripts/gmail-auth.js
//
// Sign in with the mailbox that should send the mail, approve the scopes, and
// paste the printed GMAIL_REFRESH_TOKEN into .env.local and Vercel.
//
// Node's global fetch means there is nothing to install.

import http from 'node:http'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const PORT = Number(process.env.GMAIL_OAUTH_PORT || 53682)
const REDIRECT_URI = `http://127.0.0.1:${PORT}`
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
]

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

function openBrowser(url) {
  const command =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]]

  execFile(command[0], command[1], err => {
    if (err) console.log('Could not open a browser automatically — copy the URL above.')
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

const state = crypto.randomBytes(16).toString('hex')

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString()

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
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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
    const tokens = await tokenRes.json()

    if (!tokenRes.ok || !tokens.refresh_token) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Token exchange failed. Check the terminal.')
      server.close()

      if (!tokens.refresh_token && tokens.access_token) {
        fail(
          'Google did not return a refresh token. Remove the app\'s access at ' +
            'https://myaccount.google.com/permissions and run the script again.'
        )
      } else {
        fail(`Token exchange failed: ${tokens.error_description || tokens.error || tokenRes.status}`)
      }
      return
    }

    const profile = tokens.id_token ? decodeIdToken(tokens.id_token) : null
    const sendAs = await listSendAs(tokens.access_token)

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(
      '<h2>Authorized.</h2><p>Return to the terminal for the refresh token. You can close this tab.</p>'
    )
    server.close()

    console.log('\n✔ Authorized' + (profile?.email ? ` as ${profile.email}` : '') + '\n')
    console.log('Add these to .env.local AND to the Vercel project (Production):\n')
    console.log(`GMAIL_CLIENT_ID=${clientId}`)
    console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`)
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log('EMAIL_FROM="The Family Sync <no-reply@your-domain.example>"')
    console.log(`NEXT_PUBLIC_APP_URL=${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}`)

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
  } catch (err) {
    res.writeHead(500).end()
    server.close()
    fail(err.message)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nOpen this URL, sign in with the sending mailbox, and approve access:\n')
  console.log(authUrl + '\n')
  console.log(`Waiting for the redirect on ${REDIRECT_URI} …\n`)
  openBrowser(authUrl)
})

server.on('error', err => {
  fail(`Could not listen on ${REDIRECT_URI}: ${err.message}`)
})
