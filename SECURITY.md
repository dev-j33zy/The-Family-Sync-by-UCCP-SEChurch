# Security protocol

Family Sync holds a church membership roster: names, birthdays, addresses,
phone numbers and email addresses. This document describes the layers that are
**enforced in code** and the infrastructure steps that must be done in Atlas,
Vercel and GitHub. Code layers are defence in depth — none of them replaces
least-privilege database credentials.

## 1. Transport and browser layer (`next.config.mjs`, `proxy.js`)

Every response gets:

- `Content-Security-Policy` — same-origin scripts/connections, no objects, no
  framing, no base-tag overrides, forms only to this origin. Google Fonts are
  the one explicit style/font exception.
- `Strict-Transport-Security` (production only), `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  COOP and CORP.
- No `X-Powered-By`, no production browser source maps.

`proxy.js` rejects every `POST`/`PUT`/`PATCH`/`DELETE` whose `Origin` is not this
app. Requests without an `Origin` are allowed — that is how the desktop widget
calls the API with its session cookie. Authentication cookies are `HttpOnly`,
`SameSite=Lax` and always `Secure` in production, regardless of forwarding
headers.

## 2. Authentication and sessions (`lib/auth.js`, `lib/api-auth.js`)

- Passwords are bcrypt cost 12. Existing hashes keep their embedded cost.
- Session tokens are 32 random bytes; only their SHA-256 hash is stored.
- Sessions expire after 30 days and are deleted on logout, password change and
  account deletion. Failed logins take the same time whether or not the address
  exists, so the login response cannot be used to enumerate accounts.
- Every data route now calls `requireAdmin()` or `requireUser()` **on the
  server**. The old role check in the settings page was UI only.
- Invite/reset links are single-use, SHA-256 hashed at rest, valid 48 h / 1 h,
  and all earlier links of the same purpose are invalidated when a new one is
  issued.

## 3. Input and query safety (`lib/validate.js`, `lib/db.js`)

- Request bodies are parsed with a size cap and a prototype-pollution check
  (`__proto__`, `constructor`, `prototype` are rejected).
- Free-form filter objects are copied through an allowlist into flat strings;
  Mongo operator objects cannot reach a query (`$ne`, `$where`, etc.).
- All ids go through `oid()` / a 24-hex check before being used as ObjectIds.
- Regex search terms are escaped with `escapeRegex()`.
- Imports are capped at 500 rows; SMS audiences at 2000 recipients; list
  limits, name/email lengths and member id lists are bounded.
- Emailed links come from `appUrl()`, which in production ignores the `Host`
  header and uses `NEXT_PUBLIC_APP_URL` (or a pinned fallback). URLs are escaped
  before being placed in HTML attributes.

## 4. Abuse and detection (`lib/rate-limit.js`, `lib/audit.js`)

Per-address fixed windows cover login, forgot/reset, account password checks,
member search/registration, imports, SMS sends, Sheets exports, admin account
changes and the legacy widget endpoint. The limiter keys on `x-real-ip` (set by
Vercel) rather than the caller-controlled first `x-forwarded-for` hop.

Security-relevant events (denied access, CSRF rejection, rate-limit trips,
token issuance, admin actions, failed logins, oversized imports) are written to
stdout as single-line `[security] {...}` JSON records. Point a Vercel log drain
at them to retain and alert on abuse. Sensitive fields are redacted before
serialisation.

## 5. Database clusters (MongoDB Atlas — **requires your action**)

The application uses three clusters (`MONGODB_URI`, `MONGODB_URI_MEMBERS`,
`MONGODB_URI_IMAGES`). Code-level checks cannot protect a leaked connection
string. In Atlas:

1. **Network Access**: remove `0.0.0.0/0`. Vercel's egress IPs change, so either
   use Atlas' Vercel integration to keep the allowlist in sync, or deploy with
   a static egress IP and allow only that.
2. **Database users**: one user per cluster, with `readWrite` on **only** that
   cluster's database. Do not reuse the admin-cluster credential for members
   or images. Never use an Atlas admin user in the app.
3. **Rotation**: rotate all three passwords now that they have existed in
   `.env.local`, and again on any suspected incident. Store them only in
   Vercel → Settings → Environment Variables (Production + Preview as needed).
4. **Encryption and backups**: Atlas encryption at rest and TLS 1.2+ are on by
   default; confirm the clusters have automated backups and a tested restore.
5. **Audit logs**: enable Atlas audit logging / access logs for the projects if
   your tier supports it, and alert on new IP allowlist entries or role changes.

## 6. Google and email (`lib/google-auth.js`, `lib/email-templates.js`)

A single OAuth refresh token sends admin mail and creates Sheets. Keep it in
Vercel env only. The Sheets sharing mode is `domain` by default (Workspace
members only, `allowFileDiscovery: false`); `public` is an explicit opt-in and
should not be used for the masterlist. Export actions are rate limited and
logged.

## 7. Desktop widget (`widget/main.js`)

- No DevTools and no remote debugging in packaged builds; navigation is locked
  to the widget's own local page.
- The session token is stored only via Windows `safeStorage` (OS-backed
  encryption). If encryption is unavailable, sign-in fails closed — no
  plaintext token is written — and pre-existing plaintext records are ignored,
  so upgrading from an older build signs the user out once.
- Updates are accepted only from this project's GitHub release and its CDN.
  Every redirect is host-checked, the download is size-capped, and the file's
  SHA-256 must match the digest published in the release **before** the
  installer is run. The URL passed back by the renderer is ignored.
- `shell.openExternal` accepts only HTTPS links to the app, GitHub or Google
  Docs/Drive.

**Requires your action:** the widget source in `app.asar` is still readable and
the installer is unsigned. Reverse-engineering resistance at the binary level
needs a code-signing certificate plus an obfuscation/packaging step; signing is
also what stops Windows SmartScreen warnings and prevents a substituted
installer. Old installers in git history predate the removal of embedded
credentials — treat those credentials as public and rotate them, and purge the
history if the repository is shared.

## 8. Operational checklist

- [ ] Set `NEXT_PUBLIC_APP_URL` in Vercel Production (emailed links + CSRF).
- [ ] Rotate the three MongoDB passwords and scope each user to one database.
- [ ] Remove Atlas `0.0.0.0/0` access; use Vercel integration or a static IP.
- [ ] Set `WIDGET_API_KEY` only if legacy widgets still need `/api/public/events`;
      retire it once they have been upgraded to `/api/widget/events`.
- [ ] Rotate any credential that ever appeared in an old widget installer.
- [ ] Attach a log drain for `[security]` events.
- [ ] Sign the installer with a code-signing certificate before release.
