const { app, BrowserWindow, ipcMain, screen, shell, Tray, Menu, nativeImage, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { exec } = require('child_process')

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

function applyAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
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

function appUrl() {
  const raw = (process.env.WIDGET_APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
  if (!raw) throw new Error('WIDGET_APP_URL is not set. Add it to the widget .env.')
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
            if (compareSemver(latestVer, currentVer) > 0) {
              const exeAsset = (release.assets || []).find(a => a.name.endsWith('.exe'))
              resolve({
                available: true,
                version: latestVer,
                downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
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

ipcMain.handle('download-and-install-update', (_, downloadUrl) => {
  return new Promise((resolve, reject) => {
    const tempDir = app.getPath('temp')
    const ext = '.exe'
    const tempExe = path.join(tempDir, 'family-sync-widget-update' + ext)
    const currentExe = process.execPath
    const exeName = path.basename(currentExe)

    const file = fs.createWriteStream(tempExe)
    https.get(downloadUrl, (res) => {
      res.pipe(file)
      file.on('finish', () => {
        file.close(() => {
          const scriptPath = path.join(tempDir, 'update-widget.bat')
          const lines = [
            '@echo off',
            'setlocal',
            ':wait',
            'tasklist /FI "IMAGENAME eq ' + exeName + '" 2>NUL | find /I "' + exeName + '" >NUL',
            'if %ERRORLEVEL% EQU 0 (',
            '  timeout /T 1 /NOBREAK >NUL',
            '  goto wait',
            ')',
            'copy /Y "' + tempExe + '" "' + currentExe + '"',
            'start "" "' + currentExe + '"',
            'del "%~f0"',
          ]
          fs.writeFileSync(scriptPath, lines.join('\r\n'))
          exec('start "" "' + scriptPath + '"', () => {})
          resolve({ success: true })
        })
      })
    }).on('error', (err) => {
      fs.unlink(tempExe, () => {})
      reject(err)
    })
  })
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