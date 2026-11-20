import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// After a new deploy, an open tab may request old file names that no longer exist —
// reload once to pick up the new version instead of breaking.
window.addEventListener('vite:preloadError', (e) => {
  if (sessionStorage.getItem('reloaded-after-deploy')) return
  sessionStorage.setItem('reloaded-after-deploy', '1')
  e.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
