const { app, BrowserWindow, ipcMain, screen, shell, Tray, Menu, nativeImage, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { spawn } = require('child_process')

// Look for .env next to the portable exe first (electron-builder sets
// PORTABLE_EXECUTABLE_DIR), then next to an installed exe, then in the app
// folder during development.
const envPaths = [
  process.env.PORTABLE_EXECUTABLE_DIR
    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, '.env')
    : null,
  path.join(path.dirname(process.execPath), '.env'),
  path.join(__dirname, '.env'),
].filter(Boolean)

for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) continue
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    // Real environment variables win over the file.
    if (process.env[key] === undefined) process.env[key] = val
  }
  break
}

const SETTINGS_PATH = path.join(app.getPath('userData'), 'widget-settings.json')

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))
    }
  } catch {}
  return getDefaultSettings()
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
  } catch {}
}

function getDefaultSettings() {
  return {
    width: 340,
    height: 480,
    x: undefined,
    y: undefined,
    fontSize: 14,
    fontFamily: 'Segoe UI, sans-serif',
    bgColor: '#2d2d2d',
    bgOpacity: 0.92,
    textOpacity: 1,
    theme: 'dark',
    view: 'list',
    autoStart: false,
    alwaysOnTop: true,
    startInTray: false,
  }
}

// A portable build runs from a temp folder, so `process.execPath` points at
// the extracted copy. Autostart and self-update must target the .exe the user
// actually launched (electron-builder exposes it here).
function portableExecutablePath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
}

function applyAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: portableExecutablePath(),
  })
}

let mainWindow = null
let tray = null

function createTrayIcon() {
  const iconPath = path.join(__dirname, 'assets', 'icon-16.png')
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath)
  }
  return nativeImage.createEmpty()
}

function createTray() {
  if (tray) return
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('Family Sync Widget')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Widget', click: () => { showMainWindow() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit() } },
  ]))
  tray.on('click', () => { toggleMainWindow() })
}

function showMainWindow() {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
  if (mainWindow.isMinimized()) mainWindow.restore()
}

function hideMainWindow() {
  if (!mainWindow) return
  mainWindow.hide()
}

function toggleMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    hideMainWindow()
  } else {
    showMainWindow()
  }
}

function createWindow() {
  const settings = loadSettings()
  const display = screen.getPrimaryDisplay().workAreaSize
  const startInTray = settings.startInTray

  const winSettings = {
    width: Math.min(settings.width, display.width),
    height: Math.min(settings.height, display.height),
    x: settings.x,
    y: settings.y,
    frame: false,
    icon: path.join(__dirname, 'assets', 'icon-48.png'),
    alwaysOnTop: settings.alwaysOnTop !== false,
    transparent: true,
    resizable: true,
    skipTaskbar: startInTray,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }

  if (settings.x === undefined || settings.y === undefined) {
    winSettings.x = display.width - settings.width - 20
    winSettings.y = display.height - settings.height - 60
  }

  mainWindow = new BrowserWindow(winSettings)
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'))

  // Ask the renderer to reload data whenever the widget is reopened or focused,
  // so changes made in the web app show up without waiting for the timer.
  let rendererReady = false
  mainWindow.webContents.on('did-finish-load', () => { rendererReady = true })
  const requestRefresh = () => {
    if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('refresh-events')
    }
  }
  mainWindow.on('show', requestRefresh)
  mainWindow.on('focus', requestRefresh)
  mainWindow.on('restore', requestRefresh)

  applyAutoStart(!!settings.autoStart)

  if (startInTray) {
    createTray()
  }

  // Debounced save position on drag end
  let moveTimer = null
  mainWindow.on('move', () => {
    clearTimeout(moveTimer)
    moveTimer = setTimeout(() => {
      const bounds = mainWindow.getBounds()
      saveSettings({
        ...loadSettings(),
        x: bounds.x,
        y: bounds.y,
      })
    }, 400)
  })
  let resizeTimer = null
  mainWindow.on('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      const bounds = mainWindow.getBounds()
      saveSettings({
        ...loadSettings(),
        width: bounds.width,
        height: bounds.height,
      })
    }, 400)
  })

  mainWindow.on('close', (e) => {
    if (tray && !app.isQuitting) {
      e.preventDefault()
      hideMainWindow()
    } else {
      const bounds = mainWindow.getBounds()
      saveSettings({
        ...loadSettings(),
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
      })
    }
  })
}

ipcMain.handle('get-settings', () => loadSettings())

ipcMain.handle('save-settings', (_, settings) => {
  const current = loadSettings()
  const merged = { ...current, ...settings }
  saveSettings(merged)

  if (mainWindow) {
    if ('width' in settings || 'height' in settings || 'x' in settings || 'y' in settings) {
      const bounds = mainWindow.getBounds()
      mainWindow.setBounds({
        width: 'width' in settings ? settings.width : bounds.width,
        height: 'height' in settings ? settings.height : bounds.height,
        x: 'x' in settings ? settings.x : bounds.x,
        y: 'y' in settings ? settings.y : bounds.y,
      })
    }
    if (merged.autoStart !== undefined) {
      applyAutoStart(!!merged.autoStart)
    }
    if (merged.alwaysOnTop !== undefined) {
      mainWindow.setAlwaysOnTop(!!merged.alwaysOnTop)
    }
    if (merged.startInTray !== undefined) {
      if (merged.startInTray) {
        createTray()
        mainWindow.setSkipTaskbar(true)
      } else {
        if (tray) {
          tray.destroy()
          tray = null
        }
        mainWindow.setSkipTaskbar(false)
        if (!mainWindow.isVisible()) showMainWindow()
      }
    }
    mainWindow.webContents.send('settings-updated', merged)
  }
  return merged
})

/* =============================================
   SIGN-IN (against the Family Sync app)
   ============================================= */

const AUTH_PATH = path.join(app.getPath('userData'), 'widget-auth.json')
const SESSION_COOKIE = 'fsync_session'

// Used when no .env is present (a normal install).
const DEFAULT_APP_URL = 'https://the-family-sync-by-uccp-se-church.vercel.app'

function appUrl() {
  const raw = (process.env.WIDGET_APP_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).trim()
  return raw.replace(/\/+$/, '')
}

function readAuth() {
  try {
    const stored = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'))
    if (!stored || !stored.token) return null
    const token = stored.encrypted
      ? safeStorage.decryptString(Buffer.from(stored.token, 'base64'))
      : stored.token
    return { token, email: stored.email || null }
  } catch {
    return null
  }
}

function writeAuth(auth) {
  try {
    if (!auth) {
      fs.rmSync(AUTH_PATH, { force: true })
      return
    }
    const record = { email: auth.email || null, token: auth.token, encrypted: false }
    if (safeStorage.isEncryptionAvailable()) {
      record.token = safeStorage.encryptString(auth.token).toString('base64')
      record.encrypted = true
    }
    fs.writeFileSync(AUTH_PATH, JSON.stringify(record, null, 2))
  } catch {}
}

function sessionTokenFrom(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)
  for (const cookie of cookies) {
    const pair = String(cookie).split(';')[0]
    if (pair.startsWith(SESSION_COOKIE + '=')) {
      return pair.slice(SESSION_COOKIE.length + 1)
    }
  }
  return null
}

ipcMain.handle('auth-status', () => {
  const auth = readAuth()
  return { signedIn: !!auth, email: auth ? auth.email : null }
})

ipcMain.handle('login', async (_, credentials) => {
  const email = String((credentials && credentials.email) || '').trim()
  const password = String((credentials && credentials.password) || '')
  if (!email || !password) throw new Error('Email and password are required')

  const base = appUrl()
  let response
  try {
    response = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error('Could not reach ' + base + '. Is the Family Sync app running?')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Sign in failed (' + response.status + ')')

  const token = sessionTokenFrom(response)
  if (!token) throw new Error('Sign in succeeded but no session was returned')

  const accountEmail = (data.user && data.user.email) || email
  writeAuth({ token, email: accountEmail })
  return { email: accountEmail }
})

ipcMain.handle('logout', async () => {
  const auth = readAuth()
  if (auth) {
    try {
      await fetch(appUrl() + '/api/auth/logout', {
        method: 'POST',
        headers: { Cookie: SESSION_COOKIE + '=' + auth.token },
      })
    } catch {}
  }
  writeAuth(null)
  return { signedIn: false }
})

ipcMain.handle('get-events', async () => {
  const auth = readAuth()
  if (!auth) return { unauthorized: true, members: [] }

  let response
  try {
    response = await fetch(appUrl() + '/api/widget/events', {
      headers: { Cookie: SESSION_COOKIE + '=' + auth.token },
    })
  } catch {
    throw new Error('Could not reach the Family Sync app')
  }

  if (response.status === 401) {
    writeAuth(null)
    return { unauthorized: true, members: [] }
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Failed to load events (' + response.status + ')')
  return data
})

function compareSemver(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1
    if (pa[i] < pb[i]) return -1
  }
  return 0
}

// The widget is only ever distributed as the NSIS installer, and an installed
// copy lives in a folder only an elevated process may write to, so the
// installer is the only way to update.
function isSetupAsset(name) {
  return /setup|installer/i.test(String(name || ''))
}

function pickSetupAsset(assets) {
  const exes = (assets || []).filter(a => /\.exe$/i.test(a.name))
  return exes.find(a => isSetupAsset(a.name)) || null
}

ipcMain.handle('check-for-update', () => {
  return new Promise((resolve) => {
    const req = https.get('https://api.github.com/repos/dev-j33zy/The-Family-Sync-by-UCCP-SEChurch/releases/latest', {
      headers: { 'User-Agent': 'family-sync-widget', Accept: 'application/vnd.github.v3+json' },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const release = JSON.parse(data)
          if (release.tag_name) {
            const latestVer = release.tag_name.replace(/^v/, '')
            const currentVer = require('./package.json').version
            if (!app.isPackaged) {
              // Running from source: never offer a self-update.
              resolve({ available: false })
              return
            }
            if (compareSemver(latestVer, currentVer) > 0) {
              const asset = pickSetupAsset(release.assets)
              if (!asset) {
                // No installer in this release: stay quiet instead of offering
                // an update that cannot be applied.
                resolve({ available: false })
                return
              }
              resolve({
                available: true,
                version: latestVer,
                downloadUrl: asset.browser_download_url,
                assetName: asset.name,
              })
            } else {
              resolve({ available: false })
            }
          } else {
            resolve({ available: false })
          }
        } catch {
          resolve({ available: false })
        }
      })
    })
    req.on('error', () => resolve({ available: false }))
    req.end()
  })
})

// GitHub release assets answer with a 302 to a CDN, and `https.get` does not
// follow redirects — piping the raw response wrote the HTML redirect body into
// the .exe. Follow the chain and verify we got a real executable.
function downloadToFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'))
    https
      .get(url, { headers: { 'User-Agent': 'family-sync-widget' } }, (res) => {
        const status = res.statusCode || 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          const next = new URL(res.headers.location, url).toString()
          return downloadToFile(next, dest, redirects + 1).then(resolve, reject)
        }
        if (status !== 200) {
          res.resume()
          return reject(new Error('Download failed (' + status + ')'))
        }
        const file = fs.createWriteStream(dest)
        file.on('error', reject)
        res.on('error', reject)
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve(dest)))
      })
      .on('error', reject)
  })
}

function isWindowsExecutable(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r')
    const header = Buffer.alloc(2)
    fs.readSync(fd, header, 0, 2, 0)
    fs.closeSync(fd)
    return header.toString('ascii') === 'MZ'
  } catch {
    return false
  }
}

// Batch helpers run in a hidden console so the user never sees a terminal
// window, and ping is used for the delay because `timeout` needs a real console.
const WAIT_FOR_EXIT = [
  ':wait',
  'tasklist /FI "IMAGENAME eq {exe}" 2>NUL | find /I "{exe}" >NUL',
  'if %ERRORLEVEL% EQU 0 (',
  '  ping -n 2 127.0.0.1 >NUL',
  '  goto wait',
  ')',
]

function runHiddenBatch(tempDir, fileName, lines) {
  const scriptPath = path.join(tempDir, fileName)
  fs.writeFileSync(scriptPath, lines.join('\r\n'), 'utf8')
  const child = spawn('cmd.exe', ['/c', scriptPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
}

function quitAfterHandoff() {
  setTimeout(() => {
    app.isQuitting = true
    app.quit()
  }, 300)
}

// electron-builder names the installed executable after the product name, so
// the copy the installer drops in the folder is always this file.
const APP_EXE_NAME = 'Family Sync Widget.exe'

ipcMain.handle('download-and-install-update', async (_, downloadUrl, assetName) => {
  if (!downloadUrl) throw new Error('No download URL was provided')

  const tempDir = app.getPath('temp')
  const assetFile = String(assetName || path.basename(new URL(downloadUrl).pathname) || '')
  const safeName = assetFile.replace(/[^A-Za-z0-9._ -]/g, '') || 'family-sync-widget-setup.exe'
  if (!isSetupAsset(safeName)) {
    throw new Error('This update is not an installer and cannot be applied')
  }
  const tempExe = path.join(tempDir, safeName)

  await downloadToFile(downloadUrl, tempExe)

  if (!isWindowsExecutable(tempExe)) {
    fs.unlink(tempExe, () => {})
    throw new Error('The downloaded update is not a valid Windows executable')
  }

  // Install into the folder of the exe the user actually launched. A portable
  // build run from an older release extracts to temp, so process.execPath is
  // the wrong folder; portableExecutablePath() covers both.
  const launcher = portableExecutablePath()
  const installDir = path.dirname(launcher)
  const installedExe = path.join(installDir, APP_EXE_NAME)
  const exeName = path.basename(process.execPath)

  // The installer needs elevation to write into "Program Files", so Windows
  // shows its permission prompt; run it silently into this folder (an upgrade
  // would otherwise default to C:\Program Files) and reopen the app after.
  runHiddenBatch(tempDir, 'update-widget.bat', [
    '@echo off',
    'setlocal',
    ...WAIT_FOR_EXIT.map(line => line.replace(/\{exe\}/g, exeName)),
    'start /wait "" "' + tempExe + '" /S /D=' + installDir,
    'if exist "' + installedExe + '" (',
    '  start "" "' + installedExe + '"',
    ') else (',
    '  start "" "' + launcher + '"',
    ')',
    'del "%~f0"',
    'exit /b 0',
  ])

  quitAfterHandoff()
  return { success: true, mode: 'installer' }
})

ipcMain.handle('open-external', (_, url) => {
  shell.openExternal(url)
})

app.isQuitting = false
app.on('before-quit', () => {
  app.isQuitting = true
})
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (!tray) app.quit() })