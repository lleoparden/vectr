type BenchmarkResult = {
  scenarios: Array<{
    fixture: string
    renderMs: number
    interactionMs: number
    saveReopenMs: number
    heapBytes?: number
    privateBytes: number
    workingSetBytes: number
  }>
}

declare global {
  interface Window {
    vectrBenchmark: {
      reportResult: (result: BenchmarkResult) => Promise<unknown>
      getMemory: () => Promise<{ privateBytes: number; workingSetBytes: number }>
    }
  }
}

export {}
