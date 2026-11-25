// Switches set by the user study runner (user_study/runner).
// STUDY_MODE: the runner opens the app with ?study=<block>. The participant works on the trip the runner
// prepared: the destination is fixed, no other knowledge is loaded automatically (it would mix sources across
// conditions), and the tour and example trip are hidden.
export const STUDY_MODE = (() => {
  try { return new URLSearchParams(window.location.search).has('study'); } catch { return false; }
})();

// HIDE_CONFLICTS: the condition without conflict views.
export const HIDE_CONFLICTS_KEY = 'alpacamap_study_hide_conflicts';

export const HIDE_CONFLICTS = (() => {
  try { return localStorage.getItem(HIDE_CONFLICTS_KEY) === '1'; } catch { return false; }
})();
