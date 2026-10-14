const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const isBenchmark = process.argv.includes('--benchmark')
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='))
/** The benchmark must never hang a run: quit with a failure after five minutes. */
const benchmarkWatchdogMs = 300_000
let mainWindow

async function getMemory() {
  const processes = await app.getAppMetrics()
  return processes.reduce(
    (total, process) => ({
      privateBytes: total.privateBytes + process.memory.privateBytes * 1024,
      workingSetBytes: total.workingSetBytes + process.memory.workingSetSize * 1024,
    }),
    { privateBytes: 0, workingSetBytes: 0 },
  )
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
    query: isBenchmark ? { benchmark: '1' } : {},
  })
}

app.whenReady().then(() => {
  ipcMain.handle('benchmark:memory', getMemory)

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
        : path.join(app.getPath('userData'), 'phase-one-renderer-spike.json')
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2))
      app.quit()
    }
    return payload
  })

  if (isBenchmark) {
    const watchdog = setTimeout(() => {
      console.error(`Benchmark did not report within ${benchmarkWatchdogMs} ms.`)
      app.exit(1)
    }, benchmarkWatchdogMs)
    watchdog.unref()
  }

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

