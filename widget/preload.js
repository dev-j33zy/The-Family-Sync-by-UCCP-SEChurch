const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getEvents: () => ipcRenderer.invoke('get-events'),
  authStatus: () => ipcRenderer.invoke('auth-status'),
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings-updated', (_, settings) => callback(settings))
  },
  onRefreshRequested: (callback) => {
    ipcRenderer.on('refresh-events', () => callback())
  },
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadAndInstallUpdate: (url, assetName) => ipcRenderer.invoke('download-and-install-update', url, assetName),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
})
