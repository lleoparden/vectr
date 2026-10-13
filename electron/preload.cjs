const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vectrBenchmark', {
  reportReady: () => ipcRenderer.send('benchmark:ready'),
  reportResult: (result) => ipcRenderer.invoke('benchmark:result', result),
  onRun: (callback) => ipcRenderer.once('benchmark:run', callback),
})
