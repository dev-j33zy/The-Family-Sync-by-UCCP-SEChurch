const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getEnv: () => ipcRenderer.invoke('get-env'),
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings-updated', (_, settings) => callback(settings))
  },
})
