const { app, BrowserWindow, ipcMain, screen, shell, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { exec } = require('child_process')

const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    process.env[key] = val
  }
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
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2 + 0.5
      const dy = y - size / 2 + 0.5
      const dist = Math.sqrt(dx * dx + dy * dy)
      const idx = (y * size + x) * 4
      if (dist < size / 2 - 1) {
        buf[idx] = 107
        buf[idx + 1] = 14
        buf[idx + 2] = 30
        buf[idx + 3] = 255
      } else {
        buf[idx] = 0
        buf[idx + 1] = 0
        buf[idx + 2] = 0
        buf[idx + 3] = 0
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size })
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
  const useTray = settings.autoStart && settings.startInTray

  const winSettings = {
    width: Math.min(settings.width, display.width),
    height: Math.min(settings.height, display.height),
    x: settings.x,
    y: settings.y,
    frame: false,
    alwaysOnTop: settings.alwaysOnTop !== false,
    transparent: true,
    resizable: true,
    skipTaskbar: useTray,
    hasShadow: false,
    show: !useTray,
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

  applyAutoStart(!!settings.autoStart)

  if (useTray) {
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
    if (merged.autoStart !== undefined || merged.startInTray !== undefined) {
      const shouldHide = merged.autoStart !== undefined ? !!merged.autoStart : current.autoStart
      const shouldTray = merged.startInTray !== undefined ? !!merged.startInTray : current.startInTray
      if (shouldHide && shouldTray) {
        mainWindow.setSkipTaskbar(true)
      }
    }
    mainWindow.webContents.send('settings-updated', merged)
  }
  return merged
})

ipcMain.handle('get-env', () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
}))

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
app.on('before-quit', () => { app.isQuitting = true })
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (!tray) app.quit() })
