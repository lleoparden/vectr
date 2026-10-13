const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const isBenchmark = process.argv.includes('--benchmark')
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='))
let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: !isBenchmark,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  ipcMain.on('benchmark:ready', () => {
    if (isBenchmark) mainWindow.webContents.send('benchmark:run')
  })

  ipcMain.handle('benchmark:result', async (_event, result) => {
    const metrics = await app.getAppMetrics()
    const payload = {
      capturedAt: new Date().toISOString(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
      applicationProcesses: metrics,
      rendererResult: result,
    }
    if (isBenchmark) {
      const outputPath = outputArgument
        ? path.resolve(outputArgument.slice('--output='.length))
        : path.join(app.getPath('userData'), 'phase-zero-benchmark.json')
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2))
      app.quit()
    }
    return payload
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
