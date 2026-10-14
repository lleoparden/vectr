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
  }
}

export {}
