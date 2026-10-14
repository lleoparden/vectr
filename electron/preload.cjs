const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vectrBenchmark', {
  getMemory: () => ipcRenderer.invoke('benchmark:memory'),
  reportResult: (result) => ipcRenderer.invoke('benchmark:result', result),
})

/** Image import and project files (issues #17 and #19): dialogs and disk IO live in main. */
contextBridge.exposeInMainWorld('vectrFiles', {
  openImage: () => ipcRenderer.invoke('image:open'),
  openProject: () => ipcRenderer.invoke('file:open'),
  openProjectAt: (directory) => ipcRenderer.invoke('file:open-at', directory),
  saveProject: (payload) => ipcRenderer.invoke('file:save', payload),
  defaultDirectory: () => ipcRenderer.invoke('file:default-directory'),
  scratchDirectory: () => ipcRenderer.invoke('file:scratch-directory'),
  writeRecovery: (snapshot) => ipcRenderer.invoke('recovery:write', snapshot),
  readRecovery: () => ipcRenderer.invoke('recovery:read'),
  clearRecovery: () => ipcRenderer.invoke('recovery:clear'),
  allowClose: () => ipcRenderer.invoke('app:allow-close'),
  onBeforeClose: (handler) => {
    ipcRenderer.on('app:before-close', () => handler())
  },
})
