# The Family Sync

_by UCCP Sukat_

A full-stack church family membership management web app built with **Next.js 16**, **Supabase**, and deployed to **Vercel**.

## Features

- **Dashboard** — stats cards, birthday/anniversary calendar, 7-day reminders
- **Members** — full CRUD, search, filter, sort, paginate, communicant class tracking
- **Profile Photos** — upload, crop to square, compress under 1MB, expand preview with replace/edit/delete
- **Family Tree** — interactive visualization with spouse, sibling, parent, child, and grandchild relationships
- **Admin Tools** — create users, reset passwords, delete users, list registered admins
- **Auth** — Supabase Auth admin login with invite links and password reset via email
- **Dark/Light Theme** — toggleable theme with persistent preference

## Quick Start

### 1. Create Supabase project
Go to [supabase.com](https://supabase.com) → New Project.

### 2. Run the schema
In your Supabase SQL editor, paste and run the contents of `family-sync-schema.sql`.

### 3. Configure environment
```bash
cp .env.local.example .env.local
```

Fill in your Supabase URL and keys from **Project Settings → API**.

### 4. Create admin user
After deploying, visit `/admin/create-user` to invite administrators, or use Supabase Dashboard → **Authentication → Users** to create the first account.

### 5. Run locally
```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Deploy to Vercel

1. Push this folder to a GitHub repository
2. Connect the repo in [vercel.com](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy!

## Membership Logic

| Condition | Status | Type |
|---|---|---|
| No Date of Membership | `New` | Empty |
| Date of Membership set | `Active` | `Regular` (default, overridable) |
| Manually overridden | Any | Any |

## Photo System

- Photos are stored as base64 data URLs in the database
- Upload via the add/edit member form with a draggable, resizable square crop tool
- Photos auto-compress under 1MB through iterative quality/dimension reduction
- Click a profile photo on the member detail page to expand it with options to replace, edit crop, or delete
- Profile photos display in the members list, family tree cards, and member detail page
