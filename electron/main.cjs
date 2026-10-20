const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

/** A development harness flag: render the editor, capture the window, exit. */
const screenshotArgument = process.argv.find((argument) => argument.startsWith('--screenshot='))

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
  return path.join(app.getPath('userData'), 'recovery.vectr')
}

/** Written on an orderly quit; its absence at launch is what "Vectr closed unexpectedly" means. */
function cleanExitMarker() {
  return path.join(app.getPath('userData'), 'recovery-clean-exit.json')
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
  // Linked image bytes never enter the project folder. A missing or changed link is deliberately
  // omitted here; the renderer draws its placeholder and the document stays open for Relink.
  let manifestAssets = []
  try {
    const parsed = JSON.parse(manifest)
    manifestAssets = Array.isArray(parsed.assets) ? parsed.assets : []
  } catch {
    // The renderer validates the manifest and will surface its structured error.
  }
  for (const asset of manifestAssets) {
    if (!asset || typeof asset.id !== 'string' || typeof asset.sourcePath !== 'string') continue
    if (assets.some((entry) => entry.id === asset.id)) continue
    try {
      const bytes = await fs.promises.readFile(asset.sourcePath)
      assets.push({ id: asset.id, mimeType: asset.mimeType, bytes: new Uint8Array(bytes) })
    } catch {
      // The manifest remains usable; a relink action can repair this missing source.
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
    // The window and taskbar icon: the Vectr logo, not Electron's default.
    icon: path.join(__dirname, 'icon.png'),
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

  // A development harness: optionally drive the editor with a script, then capture the window and
  // quit. Used to regenerate the site's screenshot and to reproduce visual bugs; it never runs in a
  // normal launch.
  if (screenshotArgument !== undefined) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const scriptArgument = process.argv.find((argument) => argument.startsWith('--exec='))
        if (scriptArgument !== undefined) {
          try {
            const code = fs.readFileSync(scriptArgument.split('=')[1], 'utf8')
            const result = await mainWindow.webContents.executeJavaScript(code, true)
            console.log('[exec] done: ' + JSON.stringify(result))
            await new Promise((resolve) => setTimeout(resolve, 400))
          } catch (cause) {
            console.error('[exec] failed: ' + cause)
          }
        }
        try {
          const image = await mainWindow.webContents.capturePage()
          fs.writeFileSync(screenshotArgument.split('=')[1], image.toPNG())
          console.log('[screenshot] written ' + screenshotArgument.split('=')[1])
        } catch (cause) {
          console.error('[screenshot] failed: ' + cause)
        }
        app.exit(0)
      }, 1500)
    })
  }

  // Close confirmation (issue #19): the first close asks the renderer whether work is unsaved;
  // the renderer answers with `app:allow-close`, which sets the flag and closes for real.
  mainWindow.on('close', (event) => {
    if (allowClose) return
    event.preventDefault()
    mainWindow.webContents.send('app:before-close')
  })
}

/** Optional editor smoke switch: `--smoke` or `--smoke=stress`. */
/** Optional editor smoke switch: '--smoke' or '--smoke=stress'. */
const smokeArgument = process.argv.find((argument) => argument === '--smoke' || argument.startsWith('--smoke='))
const smokeValue = smokeArgument === undefined ? null : smokeArgument.includes('=') ? smokeArgument.split('=')[1] : '1'

// A screenshot run must not see a recovery prompt from an earlier run, so it uses a fresh profile.
if (screenshotArgument !== undefined) {
  const directory = path.join(require('node:os').tmpdir(), 'vectr-screenshot-' + Date.now())
  fs.mkdirSync(directory, { recursive: true })
  app.setPath('userData', directory)
}

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

  /**
   * Recovery is a whole project folder — `userData/recovery.vectr/` — so a crashed document comes
   * back with its images, and it is written the same way a normal save is: asset bytes first, then
   * the manifest through a temporary file and a rename, and the sidecar last.
   */
  ipcMain.handle('recovery:write', async (_event, snapshot) => {
    try {
      const directory = recoveryDirectory()
      await fs.promises.mkdir(path.join(directory, 'assets'), { recursive: true })
      for (const asset of snapshot.assets ?? []) {
        // The file name is derived from the content key, exactly as a project save derives it.
        const extension = asset.mimeType === 'image/png' ? 'png' : 'jpg'
        const key = String(asset.id).replace(/^sha256-/, '')
        await fs.promises.writeFile(path.join(directory, 'assets', `${key}.${extension}`), Buffer.from(asset.bytes))
      }
      const manifestTemporary = path.join(directory, 'manifest.json.tmp')
      await fs.promises.writeFile(manifestTemporary, String(snapshot.manifest), 'utf8')
      await fs.promises.rename(manifestTemporary, path.join(directory, 'manifest.json'))
      const sidecarTemporary = path.join(directory, 'recovery.json.tmp')
      await fs.promises.writeFile(
        sidecarTemporary,
        JSON.stringify({
          savedAt: snapshot.savedAt,
          documentName: snapshot.documentName,
          directory: snapshot.directory ?? null,
          savedRevision: snapshot.savedRevision ?? 0,
        }),
        'utf8',
      )
      await fs.promises.rename(sidecarTemporary, path.join(directory, 'recovery.json'))
      return { ok: true }
    } catch (cause) {
      return failure(cause)
    }
  })

  /**
   * Reads the snapshot back, plus whether the previous session died without the clean-exit marker
   * that an orderly quit writes. The marker is consumed here, so the *next* crash is detectable.
   */
  ipcMain.handle('recovery:read', async () => {
    try {
      const directory = recoveryDirectory()
      const sidecar = path.join(directory, 'recovery.json')
      const cleanExit = fs.existsSync(cleanExitMarker())
      if (cleanExit) await fs.promises.rm(cleanExitMarker(), { force: true })
      if (!fs.existsSync(sidecar)) return { ok: true, snapshot: null, uncleanExit: false }
      const parsed = JSON.parse(await fs.promises.readFile(sidecar, 'utf8'))
      const manifest = await fs.promises.readFile(path.join(directory, 'manifest.json'), 'utf8')
      const assets = []
      for (const asset of JSON.parse(manifest).assets ?? []) {
        const extension = asset.mimeType === 'image/png' ? 'png' : 'jpg'
        const key = String(asset.id).replace(/^sha256-/, '')
        const file = path.join(directory, 'assets', `${key}.${extension}`)
        if (!fs.existsSync(file)) continue
        assets.push({ id: asset.id, mimeType: asset.mimeType, bytes: new Uint8Array(await fs.promises.readFile(file)) })
      }
      return {
        ok: true,
        snapshot: { ...parsed, manifest, assets },
        uncleanExit: !cleanExit,
      }
    } catch (cause) {
      return failure(cause)
    }
  })

  ipcMain.handle('recovery:clear', async () => {
    try {
      await fs.promises.rm(recoveryDirectory(), { recursive: true, force: true })
      return { ok: true }
    } catch (cause) {
      return failure(cause)
    }
  })

  // An orderly quit leaves this marker; a crash cannot, which is how the next launch knows.
  app.on('will-quit', () => {
    try {
      fs.mkdirSync(path.dirname(cleanExitMarker()), { recursive: true })
      fs.writeFileSync(cleanExitMarker(), JSON.stringify({ at: new Date().toISOString() }), 'utf8')
    } catch {
      // A marker that cannot be written costs a "it closed unexpectedly" question, nothing more.
    }
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
    return { name, mimeType, byteLength: bytes.byteLength, bytes: new Uint8Array(bytes), sourcePath: filePath }
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

