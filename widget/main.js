const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('path')
const fs = require('fs')

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
  }
}

function applyAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  })
}

let mainWindow = null

function createWindow() {
  const settings = loadSettings()
  const display = screen.getPrimaryDisplay().workAreaSize

  const winSettings = {
    width: Math.min(settings.width, display.width),
    height: Math.min(settings.height, display.height),
    x: settings.x,
    y: settings.y,
    frame: false,
    alwaysOnTop: settings.alwaysOnTop !== false,
    transparent: true,
    resizable: true,
    skipTaskbar: false,
    hasShadow: false,
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

  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds()
    saveSettings({
      ...loadSettings(),
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
    })
  })
}

ipcMain.handle('get-settings', () => loadSettings())

ipcMain.handle('save-settings', (_, settings) => {
  const current = loadSettings()
  const merged = { ...current, ...settings }
  saveSettings(merged)

  if (mainWindow) {
    if (merged.width !== undefined || merged.height !== undefined) {
      const bounds = mainWindow.getBounds()
      mainWindow.setBounds({
        width: merged.width !== undefined ? merged.width : bounds.width,
        height: merged.height !== undefined ? merged.height : bounds.height,
        x: merged.x !== undefined ? merged.x : bounds.x,
        y: merged.y !== undefined ? merged.y : bounds.y,
      })
    }
    if (merged.autoStart !== undefined) {
      applyAutoStart(!!merged.autoStart)
    }
    if (merged.alwaysOnTop !== undefined) {
      mainWindow.setAlwaysOnTop(!!merged.alwaysOnTop)
    }
    mainWindow.webContents.send('settings-updated', merged)
  }
  return merged
})

ipcMain.handle('get-env', () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
}))

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
