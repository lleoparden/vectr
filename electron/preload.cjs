const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vectrBenchmark', {
  getMemory: () => ipcRenderer.invoke('benchmark:memory'),
  reportResult: (result) => ipcRenderer.invoke('benchmark:result', result),
})

/** Image import (issue #17): the dialog and the file read live in the main process. */
contextBridge.exposeInMainWorld('vectrFiles', {
  openImage: () => ipcRenderer.invoke('image:open'),
})
