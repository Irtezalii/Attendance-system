import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Agentation } from 'agentation'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
    {/* Visual feedback toolbar for AI coding agents; development only. */}
    {import.meta.env.DEV && <Agentation appName="UBIT Attendance" />}
  </StrictMode>,
)
