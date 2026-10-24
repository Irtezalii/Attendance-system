import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth.tsx'

// Agentation (visual feedback toolbar for AI agents) is installed but switched off. To turn it
// back on in development: import { Agentation } from 'agentation' and render
// {import.meta.env.DEV && <Agentation appName="UBIT Attendance" />} after <BrowserRouter>.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
