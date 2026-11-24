import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './fonts.css'
import './index.css'
import App from './App.jsx'
import { initTheme } from './theme.js'
import { installPoliteFetch } from './net/politeFetch.js'

initTheme()
installPoliteFetch()

// Leaflet's flyTo divides by the map size; while the map is hidden or 0 px tall (small windows, panels
// opening) it throws "Invalid LatLng (NaN, NaN)" and takes the whole app down. Jump without animation then.
const leafletFlyTo = L.Map.prototype.flyTo
L.Map.prototype.flyTo = function (latlng, zoom, options) {
  const size = this.getSize()
  if (!size.x || !size.y) return this.setView(latlng, zoom, { animate: false })
  try { return leafletFlyTo.call(this, latlng, zoom, options) } catch { return this.setView(latlng, zoom, { animate: false }) }
}

// Keyboard access for clickable cards that are not <button>s (marked role="button" tabIndex={0}):
// Enter or Space activates them like a click.
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && el instanceof HTMLElement && el.getAttribute('role') === 'button' && el.tagName !== 'BUTTON') {
    e.preventDefault();
    el.click();
  }
})

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
