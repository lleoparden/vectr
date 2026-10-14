/// <reference types="vite/client" />

declare module 'canvaskit-wasm/bin/canvaskit.wasm?url' {
  const wasmUrl: string
  export default wasmUrl
}

declare module '*.ttf?url' {
  const fontUrl: string
  export default fontUrl
}

