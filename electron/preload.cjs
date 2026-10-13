const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vectrBenchmark', {
  getMemory: () => ipcRenderer.invoke('benchmark:memory'),
  reportResult: (result) => ipcRenderer.invoke('benchmark:result', result),
})
