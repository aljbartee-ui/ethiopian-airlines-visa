import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode is intentionally omitted: it double-invokes useEffect in
// development which causes duplicate Supabase fetches and misleading
// console output. All production builds run without StrictMode anyway.
createRoot(document.getElementById('root')!).render(<App />)
