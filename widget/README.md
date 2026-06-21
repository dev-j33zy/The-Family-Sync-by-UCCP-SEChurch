# Family Sync Desktop Widget

A floating sticky-note widget for Windows that displays upcoming birthdays and wedding anniversaries from your Supabase project.

## Setup

1. **Install dependencies**
   ```
   cd widget
   npm install
   ```

2. **Configure Supabase**
   Copy `.env.example` to `.env` and fill in your project details:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
   These are the same values from your `family-sync/.env.local`.

3. **RLE policy for read access**
   The widget uses the anon key (read-only) so your Supabase `members` table needs:
   ```sql
   CREATE POLICY "anon can read members"
     ON members FOR SELECT
     TO anon
     USING (true);
   ```
   ⚠️ Only add this if you're comfortable with public read access. Otherwise, generate a scoped service token.

4. **Launch**
   ```
   npm start
   ```

## Usage

- **Move** — drag the title bar
- **Resize** — drag the bottom-right corner
- **Close** — click × (keeps running in background)
- **Settings** — click ⚙ to change font, color, opacity, theme
- **Refresh** — click ↻ or wait for auto-refresh (30 min)

## Build portable exe

```
npm run build
```

Output in `dist/Family Sync Widget Setup.exe`.
