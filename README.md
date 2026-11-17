# The Family Sync

_by UCCP Sukat_

A full-stack church family membership management web app built with **Next.js 16**, **MongoDB (Mongoose)**, and **MongoDB Atlas**. Authentication is a built-in app login (users + bcrypt in the app's own database).

## Features

- **Dashboard** — stats cards, birthday/anniversary calendar, 7-day reminders
- **Members** — full CRUD, search, filter, sort, communicant class tracking
- **Export** — masterlist as a print-ready PDF, an Excel or CSV file, or a Google Sheet created in the church account's Drive
- **Profile Photos** — upload, crop to square, compress under 1MB, expand preview with replace/edit/delete
- **Family Tree** — interactive visualization with spouse, sibling, parent, child, and grandchild relationships
- **Admin Tools** — invite users by email, send password-reset links, delete users, test email delivery, list registered admins
- **Auth** — custom app login (email + password, bcrypt-hashed) with session cookie; admins invited from the admin console or seeded with `create-admin.js`
- **Email** — Gmail API from the church Workspace mailbox: invitations, password resets, and account-change notifications
- **Dark/Light Theme** — toggleable theme with persistent preference

## Architecture

- **App hosting**: any Node.js host (self-hosted, container, or a Node platform such as Vercel). Build with `npm run build` and serve with `npm start`; `next.config.mjs` also pins `outputFileTracingRoot` so a parent folder's `package-lock.json` does not change the traced workspace.
- **Database**: MongoDB via [Mongoose](https://mongoosejs.com/), spread across **three Atlas clusters** so a data problem never touches auth or photo bytes:

  | Cluster | Env var | Stores |
  |---|---|---|
  | Admin | `MONGODB_URI` | users + sessions |
  | Members | `MONGODB_URI_MEMBERS` | family groups, members, relationships, text blasts |
  | Images | `MONGODB_URI_IMAGES` | profile photo bytes |

  Models live in `lib/models/`; `lib/models/index.js` exposes `modelsFor(domain)`, and `lib/db.js` holds one cached connection per domain. Cross-cluster `populate()` is not supported, so references between clusters (e.g. a blast's `created_by`) are resolved with a second query. Date-only fields (`date_of_birth`, `wedding_anniversary`, `date_of_membership`) are stored at **UTC midnight** and written through `parseDateOnly()`, so the API returns the same calendar day whatever the server timezone (local dev in UTC+8, Vercel in UTC).
- **Auth**: sessions signed in `lib/auth.js`, verified on every API route; no external auth provider.
- **Email**: `lib/email.js` sends through the Gmail API with a Workspace refresh token; `lib/auth-tokens.js` issues single-use invite/reset links (hashed in the admin cluster, 48 h for invites, 1 h for resets).
- **Export**: `lib/member-export.js` defines the masterlist columns once; the settings page renders them with jsPDF or writes them with SheetJS (Excel/CSV) in the browser, and `app/api/export/sheets/route.js` writes the same rows into a new spreadsheet through the Sheets API.
- **Desktop widget**: Electron app that signs in with a Family Sync account and reads birthdays/anniversaries from `/api/widget/events`; no database credentials on the client.
- **MongoDB only**: every read and write goes through the three Atlas clusters above. There is no Postgres/Supabase runtime, SDK, or connection string in the app.

## Local Development

### 1. Database

Create three MongoDB Atlas clusters (or three databases on one local `mongod`): admin, members, and images.

```bash
# Atlas: create the clusters and copy each SRV connection string, or
# local: install MongoDB Community Server and run `mongod`
```

Atlas requires your IP under **Network Access**. The database name is part of each URI (for example `db-admin-user`, `db-members`, `db-images`).

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the three connection strings:

```env
MONGODB_URI=mongodb+srv://user:password@admin-cluster.example.mongodb.net/db-admin-user?retryWrites=true&w=majority
MONGODB_URI_MEMBERS=mongodb+srv://user:password@members-cluster.example.mongodb.net/db-members?retryWrites=true&w=majority
MONGODB_URI_IMAGES=mongodb+srv://user:password@images-cluster.example.mongodb.net/db-images?retryWrites=true&w=majority
```

Percent-encode special characters in passwords (`@` → `%40`, `$` → `%24`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`); a raw `@` makes the URI unparseable.

`WIDGET_API_KEY` is optional and only keeps the **legacy** `GET /api/public/events` endpoint working for widget builds older than v1.4.0. The current desktop widget signs in with a normal account and uses the session-authenticated `GET /api/widget/events`, so once every installed widget is on 1.4.0+ the legacy endpoint and the key can be removed.

### 3. Create the first admin user

```bash
node create-admin.js admin@example.com --password 'YourPass!'
```

Omitting `--password` generates a random one. Indexes (including the unique
email and member_code indexes) are created automatically on first use.

### 4. Run the app

```bash
npm install
npm run dev
```

Visit http://localhost:3000

> **Note (Windows):** your PowerShell execution policy may block `npm.ps1`; call `npm.cmd` instead.

## Data Storage

All application data lives in the three MongoDB Atlas clusters (admin,
members, images). The app talks to MongoDB directly through Mongoose; there is
no Postgres or Supabase client, SDK, migration folder, or connection string in
the codebase.

To create or reset an account, use `node create-admin.js <email>` after the
admin cluster is configured. 

## Environment Variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Admin cluster: users + sessions |
| `MONGODB_URI_MEMBERS` | Members cluster: groups, members, relationships, text blasts |
| `MONGODB_URI_IMAGES` | Images cluster: profile photo bytes |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` | Google API credentials for email **and** the Sheets export (see **Email** below) |
| `EMAIL_FROM` | Address mail is sent from, e.g. `The Family Sync <no-reply@domain>`; must be the authorized mailbox or a verified "Send mail as" alias |
| `NEXT_PUBLIC_APP_URL` | Absolute app URL used in emailed links; required in production |
| `WIDGET_API_KEY` | Legacy only: authorizes `GET /api/public/events` for widgets older than v1.4.0 (retire it once they are upgraded) |
| `SMS_PROVIDER` | SMS provider mode; use `log` for development (default) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Required only when `SMS_PROVIDER=twilio` |
| `NEXT_PUBLIC_SMS_DEFAULT_COUNTRY_CODE` | Dialing code assumed for members' phone numbers (default `63`) |

## Email (Gmail API)

Account email is for administrators and the committee only — members never get
a login. All messages are sent from the church's Google Workspace mailbox
through the Gmail API, which is included in the Workspace subscription (no
per-email cost, roughly 2,000 messages/day per user).

**One-time setup**

1. Google Cloud Console → create a project → **APIs & Services → Library** →
   enable **Gmail API**, **Google Sheets API** and **Google Drive API**.
2. **OAuth consent screen** → User type **Internal** → publishing status
   **In production**. Internal apps skip Google's verification review, and a
   production consent screen keeps the refresh token alive (tokens from a
   "Testing" app expire after 7 days).
3. **Credentials → Create credentials → OAuth client ID → Desktop app**.
4. In Gmail, add the From address under **Settings → Accounts → "Send mail
   as"** and verify it (skip if you send as the mailbox itself).
5. Put the client id/secret in `.env.local`, then run:

   ```bash
   npm run google-auth
   ```

   It opens a consent page, prints `GMAIL_REFRESH_TOKEN`, and lists every
   address the mailbox is allowed to send as. One consent covers the Gmail,
   Sheets and Drive (app-created files) scopes. Copy the values into
   `.env.local` and into the Vercel project (Production).

   If the browser never makes it back to `127.0.0.1:53682` (firewall, remote
   session, browser on another machine), run `npm run google-auth --
   --manual`, open the printed URL yourself, and paste the address you land on
   — it still contains the code even though the page cannot load.

   `node scripts/email-check.js you@example.com` sends a test message with the
   credentials in `.env.local`, without needing to sign in to the app.

6. Sign in as an administrator → **Admin Tools → Test Email** to confirm
   delivery end to end.

**What the app sends**

| Message | Trigger | Notes |
|---|---|---|
| Invitation | Admin creates a user | 48-hour single-use link; opening it verifies the address and lets the person choose their own password |
| Password reset | Admin "Send Reset Link", or "Forgot password?" on the login page | 1-hour single-use link; sessions are signed out once it is used |
| Password changed | Self-service change or reset | Confirms the change; sent after the response |
| Sign-in email changed | Settings | Sent to **both** the old and new address |
| Account name updated | Settings | Confirms the new name |
| Test email | Admin Tools | Verifies credentials without creating a user |

If an invitation cannot be delivered (misconfiguration, Gmail rejection) the
Admin Tools page shows the link so it can be passed along by hand. Public
"forgot password" never reveals whether an address has an account.

## Export (PDF, Excel, CSV and Google Sheets)

**Settings → Data Management** has one button per format — no dropdown:

| Button | What it does |
|---|---|
| **Export PDF** | Renders the masterlist with jsPDF in the browser (landscape A4, repeating column headers, page numbers) and downloads `SEC Membership Masterlist (MM-DD-YYYY).pdf`. Nothing is uploaded. |
| **Export to Google Sheets** | Creates a spreadsheet with that same name in the authorized mailbox's Drive, fills its `Members` sheet, shares it with the signed-in administrator, and opens it in a new tab. |
| **Export Excel** | Downloads the masterlist as `.xlsx` with sensible column widths. |
| **Export CSV** | Downloads the same rows as `.csv` for other tools. |

All four buttons read the column list in `lib/member-export.js`, so the outputs
cannot drift apart. Excel, CSV and Sheets keep the stored values (`new`,
`active`, …) so an export can be re-imported unchanged; the PDF shows the
display labels ("Preparatory"). The Sheets button needs the Google setup above —
the Sheets and Drive APIs enabled and a refresh token minted after those scopes
were added. If that is missing the request fails with a message naming the step,
not a silent error. Every sheet export is a new file owned by the church mailbox;
the administrator also gets a share, so it appears in their own Drive too.

## Desktop Widget

See [`widget/README.md`](widget/README.md). Build the setup installer with `npm run build`; that one file is what every GitHub release publishes, because an installed copy can only update through the installer. Sign in from the widget with a Family Sync account; it calls the session-authenticated `/api/widget/events`, so no database user or shared key is needed. The installer defaults to the production app URL and only needs a `WIDGET_APP_URL` in a `.env` next to the installed `.exe` when you want to point it somewhere else (for example `http://localhost:3000`).

## Membership Logic

| Condition | Status | Type |
|---|---|---|
| No Date of Membership | `Preparatory` | Empty |
| Date of Membership set | `Active` | `Regular` (default, overridable) |
| Manually overridden | Any | Any |

## Photo System

- Photo bytes live in the `MONGODB_URI_IMAGES` cluster; member documents only store a `has_profile_picture` flag
- The API returns `profile_picture` as a short `/api/images/<id>?v=<updated_at>` URL served by `app/api/images/[id]/route.js`
- Upload via the add/edit member form with a draggable, resizable square crop tool
- Photos auto-compress under 1MB through iterative quality/dimension reduction on the client
- The API also rejects uploads over **4 MB** or outside PNG/JPEG/WebP/GIF, before the member row is written (MongoDB documents are capped at 16 MB, and base64 inflates bytes by about a third)
- Click a profile photo on the member detail page to expand it with options to replace, edit crop, or delete
- Profile photos display in the members list, family tree cards, and member detail page

## Security Notes

- `GET /api/members?search=…` is the only unauthenticated read. It returns just `first_name`, `last_name`, and `date_of_birth` (for the registration duplicate check), requires a 2-character term, caps results at 20, and is rate limited per IP.
- `POST /api/members` (public registration) and `POST /api/auth/login` are rate limited per IP.
- `POST /api/auth/forgot-password` returns the same response whether or not the address exists, and sends the mail after the response so timing does not reveal it. It is limited to 5 requests per IP and 3 per address per 15 minutes.
- Invite and reset tokens are 32 random bytes, stored only as SHA-256 hashes in the admin cluster, single-use, and expire after 48 hours (invite) or 1 hour (reset). Using one signs out every other session, and the token is only burned once the new password passes validation.
- Changing the sign-in email or password requires the current password. Changing the email notifies both the old and the new address.
- Passwords must be at least 8 characters (`lib/password-policy.js`).
- Photo uploads are validated by type and size on the server (see above).
- The in-memory limiter lives in `lib/rate-limit.js`. On a serverless host each instance keeps its own counters, which stops casual brute force and scripted spam but is not a cluster-wide quota; a shared store would be needed for that.

## Project Layout

```
app/                  Next.js pages + API route handlers
components/           Shared React components
lib/db.js             Mongoose connections (admin/members/images) + shared helpers
lib/models/           Mongoose schemas + modelsFor(domain)
lib/images.js         Profile photo storage in the images cluster
lib/auth.js           Session + password helpers
lib/auth-tokens.js    Invite / password-reset tokens (hashed, single-use)
lib/google-auth.js    Google OAuth refresh-token exchange shared by email + export
lib/email.js          Gmail API sender (MIME builder)
lib/email-templates.js  Invite, reset and notification message bodies
lib/account-mail.js   Who gets which account email
lib/member-export.js  Masterlist columns shared by the PDF and Sheets exports
lib/serialize.js      API response shaping (id, dates, nested relations)
scripts/              Google auth, admin creation + member-code backfill helpers
widget/               Electron desktop widget
```
