// Light / dark appearance. The app is designed dark; the light theme is a colour-inverting layer
// (see index.css, html[data-theme="light"]) that keeps the map, photos and markers in their real colours.
const KEY = 'alpacamap_theme';

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* storage blocked: keep for this session only */ }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('alpacamap-theme', { detail: theme }));
}

// ?theme=light in the URL forces a theme (useful for screenshots and the user study)
export function initTheme() {
  const q = new URLSearchParams(window.location.search).get('theme');
  if (q === 'light' || q === 'dark') { setTheme(q); return q; }
  const t = getTheme();
  applyTheme(t);
  return t;
}
