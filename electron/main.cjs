const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const isBenchmark = process.argv.includes('--benchmark')
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='))
/** Optional renderer-candidate switch, for example `--candidate=vello`. */
const candidateArgument = process.argv.find((argument) => argument.startsWith('--candidate='))
/** Optional fixture filter (for example `--contents=primitives`) for quick checks. */
const contentsArgument = process.argv.find((argument) => argument.startsWith('--contents='))
/** The benchmark must never hang a run: quit with a failure after five minutes. */
const benchmarkWatchdogMs = 300_000
let mainWindow
/** Set once the renderer has answered the close question, so the second close goes through. */
let allowClose = false

/** Writes a project: assets first, then the manifest through a temporary file and a rename. */
async function writeProjectToDisk(directory, manifest, assets, usedAssetIds) {
  const assetDirectory = path.join(directory, 'assets')
  await fs.promises.mkdir(assetDirectory, { recursive: true })

  let written = 0
  let reused = 0
  for (const asset of assets) {
    if (!usedAssetIds.includes(asset.id)) continue
    const extension = asset.mimeType === 'image/png' ? 'png' : 'jpg'
    const target = path.join(assetDirectory, `${String(asset.id).replace(/^sha256-/, '')}.${extension}`)
    if (fs.existsSync(target)) {
      // Content-addressed: a file under this key already is the right bytes.
      reused += 1
      continue
    }
    const temporary = `${target}.tmp`
    await fs.promises.writeFile(temporary, Buffer.from(asset.bytes))
    await fs.promises.rename(temporary, target)
    written += 1
  }

  const manifestTemporary = path.join(directory, 'manifest.json.tmp')
  await fs.promises.writeFile(manifestTemporary, manifest, 'utf8')
  await fs.promises.rename(manifestTemporary, path.join(directory, 'manifest.json'))
  await fs.promises.writeFile(
    path.join(directory, 'metadata.json'),
    `${JSON.stringify(
      { savedAt: new Date().toISOString(), app: 'Vectr', manifestVersion: 1, formatVersion: 1 },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const kept = new Set(usedAssetIds.map((id) => String(id).replace(/^sha256-/, '')))
  let pruned = 0
  for (const name of await fs.promises.readdir(assetDirectory)) {
    if (kept.has(name.replace(/\.[a-z]+$/i, ''))) continue
    await fs.promises.unlink(path.join(assetDirectory, name))
    pruned += 1
  }
  return { writtenAssets: written, reusedAssets: reused, prunedAssets: pruned, manifestPath: path.join(directory, 'manifest.json') }
}

/** Recovery snapshots live outside any project, so a failed save cannot corrupt recovery. */
function recoveryDirectory() {
  return path.join(app.getPath('userData'), 'recovery')
}

/** Every file failure becomes a structured result; the renderer never sees a partial project. */
function failure(cause) {
  return {
    ok: false,
    code: cause && cause.code ? String(cause.code) : 'io-error',
    message: cause ? String(cause.message ?? cause) : 'Unknown file error.',
  }
}

/** Reads a project directory: the manifest text plus the asset bytes it points at. */
async function readProject(directory) {
  const manifest = await fs.promises.readFile(path.join(directory, 'manifest.json'), 'utf8')
  const assetDirectory = path.join(directory, 'assets')
  const assets = []
  if (fs.existsSync(assetDirectory)) {
    for (const name of await fs.promises.readdir(assetDirectory)) {
      const bytes = await fs.promises.readFile(path.join(assetDirectory, name))
      // The document already knows the content key and MIME type; the file name only needs to
      // let the renderer find the bytes again.
      const mimeType = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      assets.push({ id: `sha256-${name.replace(/\.[a-z]+$/i, '')}`, mimeType, bytes: new Uint8Array(bytes) })
    }
  }
  return { manifest, assets }
}

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
    query: isBenchmark
      ? {
          benchmark: '1',
          ...(contentsArgument ? { contents: contentsArgument.slice('--contents='.length) } : {}),
          ...(candidateArgument ? { candidate: candidateArgument.slice('--candidate='.length) } : {}),
        }
      : smokeValue !== null
        ? { smoke: smokeValue }
        : {},
  })

  // Forward renderer diagnostics so a failed or hung benchmark is visible on stdout.
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    console.log(`[renderer:${level}] ${message}`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`Renderer process gone: ${details.reason} (exitCode ${details.exitCode})`)
  })
  mainWindow.webContents.on('unresponsive', () => {
    console.error('Renderer became unresponsive during the benchmark.')
  })

  // Close confirmation (issue #19): the first close asks the renderer whether work is unsaved;
  // the renderer answers with `app:allow-close`, which sets the flag and closes for real.
  mainWindow.on('close', (event) => {
    if (allowClose) return
    event.preventDefault()
    mainWindow.webContents.send('app:before-close')
  })
}

/** Optional editor smoke switch: `--smoke` or `--smoke=stress`. */
const smokeArgument = process.argv.find((argument) => argument === '--smoke' || argument.startsWith('--smoke='))
const smokeValue = smokeArgument === undefined ? null : smokeArgument.includes('=') ? smokeArgument.split('=')[1] : '1'

app.whenReady().then(() => {
  // Vectr draws its own menu bar, the way Illustrator does, so the Electron default menu
  // (File, Edit, View, Window, Help) is removed: it would otherwise put a second menu bar
  // in the window and take Alt away from Vectr's own menu mnemonics.
  Menu.setApplicationMenu(null)

  ipcMain.handle('benchmark:memory', getMemory)

  /**
   * Image import (issue #17): the file dialog and the read belong in the main process, so the
   * renderer never needs filesystem access. The bytes travel as a typed array over IPC.
   */
  ipcMain.handle('file:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open a Vectr project',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: true, canceled: true }
    try {
      const project = await readProject(result.filePaths[0])
      return { ok: true, canceled: false, directory: result.filePaths[0], manifest: project.manifest, assets: project.assets }
    } catch (cause) {
      return failure(cause)
    }
  })

  ipcMain.handle('file:save', async (_event, payload) => {
    const settings = payload || {}
    let directory = typeof settings.directory === 'string' && settings.directory !== '' ? settings.directory : null
    if (directory === null || settings.askForPath === true) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save the Vectr project',
        defaultPath: settings.suggestedName || 'Untitled.vectr',
      })
      if (result.canceled || !result.filePath) return { ok: true, canceled: true }
      directory = result.filePath
    }
    try {
      const report = await writeProjectToDisk(
        directory,
        String(settings.manifest || ''),
        Array.isArray(settings.assets) ? settings.assets : [],
        Array.isArray(settings.usedAssetIds) ? settings.usedAssetIds : [],
      )
      return { ok: true, canceled: false, directory, ...report }
    } catch (cause) {
      return failure(cause)
    }
  })

  /** A directory for the smoke run and for first saves, without showing a dialog. */
  ipcMain.handle('file:default-directory', () => app.getPath('documents'))

  /** A scratch directory under user data, so automated runs never litter the user's folders. */
  ipcMain.handle('file:scratch-directory', () => path.join(app.getPath('userData'), 'scratch'))

  ipcMain.handle('file:open-at', async (_event, directory) => {
    try {
      const project = await readProject(String(directory))
      return { ok: true, canceled: false, directory: String(directory), manifest: project.manifest, assets: project.assets }
    } catch (cause) {
      return failure(cause)
    }
  })

  ipcMain.handle('recovery:write', async (_event, snapshot) => {
    try {
      const directory = recoveryDirectory()
      await fs.promises.mkdir(directory, { recursive: true })
      const temporary = path.join(directory, 'recovery.json.tmp')
      await fs.promises.writeFile(temporary, JSON.stringify(snapshot), 'utf8')
      await fs.promises.rename(temporary, path.join(directory, 'recovery.json'))
      return { ok: true }
    } catch (cause) {
      return failure(cause)
    }
  })

  ipcMain.handle('recovery:read', async () => {
    try {
      const file = path.join(recoveryDirectory(), 'recovery.json')
      if (!fs.existsSync(file)) return { ok: true, snapshot: null }
      return { ok: true, snapshot: JSON.parse(await fs.promises.readFile(file, 'utf8')) }
    } catch (cause) {
      return failure(cause)
    }
  })

  ipcMain.handle('recovery:clear', async () => {
    try {
      await fs.promises.rm(path.join(recoveryDirectory(), 'recovery.json'), { force: true })
      return { ok: true }
    } catch (cause) {
      return failure(cause)
    }
  })

  ipcMain.handle('dialog:confirm-close', async (_event, payload) => {
    const name = payload && payload.name ? String(payload.name) : 'this document'
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Vectr',
      message: `Save changes to ${name} before closing?`,
      detail: 'Continuing without saving keeps a recovery snapshot, which Vectr offers on the next launch.',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    })
    return result.response === 0 ? 'save' : result.response === 1 ? 'discard' : 'cancel'
  })

  ipcMain.handle('app:allow-close', () => {
    allowClose = true
    mainWindow?.close()
    return { ok: true }
  })

  ipcMain.handle('image:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Place an image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const name = path.basename(filePath)
    const lower = name.toLowerCase()
    const mimeType = lower.endsWith('.png') ? 'image/png' : 'image/jpeg'
    const bytes = fs.readFileSync(filePath)
    return { name, mimeType, byteLength: bytes.byteLength, bytes: new Uint8Array(bytes) }
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

