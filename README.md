# The Family Sync

_by UCCP Sukat_

A full-stack church family membership management web app built with **Next.js 16**, **MongoDB (Mongoose)**, and **MongoDB Atlas**. Authentication is a built-in app login (users + bcrypt in the app's own database).

## Features

- **Dashboard** — stats cards, birthday/anniversary calendar, 7-day reminders
- **Members** — full CRUD, search, filter, sort, paginate, communicant class tracking
- **Profile Photos** — upload, crop to square, compress under 1MB, expand preview with replace/edit/delete
- **Family Tree** — interactive visualization with spouse, sibling, parent, child, and grandchild relationships
- **Admin Tools** — create users, reset passwords, delete users, list registered admins
- **Auth** — custom app login (email + password, bcrypt-hashed) with session cookie; admins created via `create-admin.js` or the admin console
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
| `WIDGET_API_KEY` | Legacy only: authorizes `GET /api/public/events` for widgets older than v1.4.0 (retire it once they are upgraded) |
| `SMS_PROVIDER` | SMS provider mode; use `log` for development (default) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Required only when `SMS_PROVIDER=twilio` |
| `NEXT_PUBLIC_SMS_DEFAULT_COUNTRY_CODE` | Dialing code assumed for members' phone numbers (default `63`) |

## Desktop Widget

See [`widget/README.md`](widget/README.md). Build the portable exe with `npm run build`, or both the portable exe and the setup installer (`npm run build:all`) — every GitHub release must publish both, because an installed copy can only update through the installer. Sign in from the widget with a Family Sync account; it calls the session-authenticated `/api/widget/events`, so no database user or shared key is needed. The portable `.exe` defaults to the production app URL and only needs a `WIDGET_APP_URL` in a `.env` next to it when you want to point it somewhere else (for example `http://localhost:3000`).

## Membership Logic

| Condition | Status | Type |
|---|---|---|
| No Date of Membership | `New` | Empty |
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
lib/serialize.js      API response shaping (id, dates, nested relations)
scripts/              Admin creation + member-code backfill helpers
widget/               Electron desktop widget
```
