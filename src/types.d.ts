type MemorySample = {
  privateBytes: number
  workingSetBytes: number
}

/** Payload transferred to the main process for a recorded benchmark run. */
type BenchmarkPayload = {
  record: {
    schemaVersion: number
    fixtureVersion: number
    reportKind: string
    capturedAt: string
    renderer: { backend: string; wasmBytes: number; webglAvailable: boolean; fontLoaded: boolean }
    environment: Record<string, unknown>
    scenarios: unknown[]
    notes: string[]
  }
  memory: MemorySample
}

declare global {
  interface Window {
    vectrBenchmark: {
      reportResult: (payload: BenchmarkPayload) => Promise<unknown>
      getMemory: () => Promise<MemorySample>
    }
    /** File bridge (issues #17 and #19); absent in a plain browser build. */
    vectrFiles?: {
      openImage: () => Promise<{
        name: string
        mimeType: string
        byteLength: number
        bytes: Uint8Array
      } | null>
      openProject: () => Promise<
        | { ok: true; canceled: true }
        | {
            ok: true
            canceled: false
            directory: string
            manifest: string
            assets: Array<{ id: string; mimeType: string; bytes: Uint8Array }>
          }
        | { ok: false; code: string; message: string }
      >
      saveProject: (payload: {
        directory?: string | null
        askForPath?: boolean
        suggestedName?: string
        manifest: string
        assets: Array<{ id: string; mimeType: string; bytes: Uint8Array }>
        usedAssetIds: string[]
      }) => Promise<
        | { ok: true; canceled: true }
        | {
            ok: true
            canceled: false
            directory: string
            writtenAssets: number
            reusedAssets: number
            prunedAssets: number
          }
        | { ok: false; code: string; message: string }
      >
      defaultDirectory: () => Promise<string>
      /** Automated runs only: read a project by path instead of through the dialog. */
      openProjectAt: (directory: string) => Promise<
        | {
            ok: true
            canceled: false
            directory: string
            manifest: string
            assets: Array<{ id: string; mimeType: string; bytes: Uint8Array }>
          }
        | { ok: false; code: string; message: string }
      >
      /** Automated runs only: a scratch directory under user data. */
      scratchDirectory: () => Promise<string>
      writeRecovery: (snapshot: {
        savedAt: string
        documentName: string
        directory: string | null
        manifest: string
      }) => Promise<{ ok: boolean; code?: string; message?: string }>
      readRecovery: () => Promise<{
        ok: boolean
        snapshot?: { savedAt: string; documentName: string; directory: string | null; manifest: string } | null
      }>
      clearRecovery: () => Promise<{ ok: boolean }>
      confirmClose: (payload: { name: string }) => Promise<'save' | 'discard' | 'cancel'>
      allowClose: () => Promise<{ ok: boolean }>
      onBeforeClose: (handler: () => void) => void
    }
  }
}

export {}
