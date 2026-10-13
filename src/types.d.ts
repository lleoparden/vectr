type BenchmarkResult = {
  scenarios: Array<{
    fixture: string
    renderMs: number
    interactionMs: number
    saveReopenMs: number
    heapBytes?: number
  }>
}

declare global {
  interface Window {
    vectrBenchmark: {
      reportReady: () => void
      reportResult: (result: BenchmarkResult) => Promise<unknown>
      onRun: (callback: () => void) => void
    }
  }
}

export {}
