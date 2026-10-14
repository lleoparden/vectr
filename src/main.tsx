import { createRoot } from 'react-dom/client'
import { BenchmarkApp } from './app/BenchmarkApp.tsx'
import './styles.css'

createRoot(document.getElementById('root')!).render(<BenchmarkApp />)
