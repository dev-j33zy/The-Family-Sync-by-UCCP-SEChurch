# The Family Sync

A full-stack family membership management web app built with **Next.js 16**, **Supabase**, and deployed to **Vercel**.

## Features
- 🏠 **Dashboard** — stats cards, birthday/anniversary calendar, 7-day reminders
- 👥 **Members** — full CRUD, search, filter, sort, paginate, communicant class tracking
- 🌳 **Family Tree** — interactive visualization with cross-family linking
- 🔐 **Auth** — Supabase Auth admin login

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
