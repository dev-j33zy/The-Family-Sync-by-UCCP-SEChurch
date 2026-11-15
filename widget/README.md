# Family Sync Desktop Widget

A floating sticky-note widget for Windows that displays upcoming birthdays and wedding anniversaries from your Family Sync app.

Current version: **1.4.1**

## What's new in 1.4.1

- **Works on a fresh download** — with no `.env` next to the exe, the widget now defaults to the production app URL instead of refusing to start.
- **Updates actually stick** — the updater follows GitHub's download redirect, verifies the file is a real Windows executable, and replaces the portable launcher instead of the temp copy that gets thrown away.
- **Start with Windows survives a reboot** — autostart now points at the launcher exe, not the temporary extraction path.
- Couple anniversaries are no longer listed twice, and a birthday shows the age the member actually turns today.
- An expired session now says so instead of silently showing the sign-in screen.

## What's new in 1.4.0

- **Sign in with your Family Sync account** — the widget no longer stores a database credential or shared API key.
- Data comes from the session-authenticated `GET /api/widget/events` endpoint instead of talking to MongoDB directly.
- The session token is stored encrypted with Electron `safeStorage`; signing out revokes it on the server and deletes it locally.
- Signed-out state in both the list and calendar views, with an inline **Sign in** link.
- Smaller package: the MongoDB driver and all database settings were removed.
- Data refreshes every 5 minutes and whenever the widget is reopened or focused, so new members show up without a restart.

Release notes for every version are on the [GitHub releases page](https://github.com/dev-j33zy/The-Family-Sync-by-UCCP-SEChurch/releases).

## Requirements

- Windows 10 or later.
- The Family Sync app must be running and reachable at the URL you configure.
- A Family Sync account (the same email and password you use on the website).

## Setup

1. **Install dependencies**
   ```
   cd widget
   npm install
   ```

2. **Point it at your app**

   Copy `.env.example` to `.env` and set the app URL:
   ```
   WIDGET_APP_URL=http://localhost:3000
   ```

   The widget only needs this URL. It does not read any database credentials.

3. **Launch**
   ```
   npm start
   ```

4. **Sign in**

   Open the **⋯** menu and choose **Sign in**, then use your normal Family Sync account. The session is remembered until you sign out or it expires.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `WIDGET_APP_URL` | No | Base URL of the Family Sync app. Defaults to the production site (`https://the-family-sync-by-uccp-se-church.vercel.app`); set it to `http://localhost:3000` to point at a local copy. Trailing slashes are ignored. |

In the portable build the `.env` is **not** bundled. You only need one if you want to override the default URL: place it next to the `.exe` (the widget also accepts one next to an installed `.exe` or inside the app folder during development).

## Usage

- **Move** — drag the title bar
- **Resize** — drag the bottom-right corner
- **Close** — click ×
- **Settings** — click ⚙ to change font, color, opacity, theme
- **Refresh** — click ↻. The widget also polls every 5 minutes and refreshes whenever you reopen or focus it, so changes made in the web app appear without restarting.
- **Sign in / Sign out** — click ⋯ → Sign in
- **Check for updates** — the widget compares its version with the latest GitHub release

## Build portable exe

```
npm run build
```

Output in `dist/` (for example `Family Sync Widget 1.4.1.exe`).

If the build fails with `Cannot create symbolic link ... winCodeSign` (Windows without Developer Mode), build with exe icon/version editing disabled:

```
npx electron-builder --win portable --config.win.signAndEditExecutable=false
```

## Security

The widget never stores your password. It keeps only the session token returned by the app, encrypted with the OS keystore where available; signing out deletes it and revokes the session server-side. No MongoDB URI or API key is embedded in the app or its settings.
