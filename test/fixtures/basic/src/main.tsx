import { createRoot } from 'react-dom/client'
import App from './App'

// StrictMode intentionally omitted — this fixture is consumed by fiber-walk
// e2e tests that assert single-mount counts. See MCP v1 spec.
createRoot(document.getElementById('root')!).render(<App />)