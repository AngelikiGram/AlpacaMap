// Set by the user study runner (user_study/runner) for the condition without conflict views.
export const HIDE_CONFLICTS_KEY = 'alpacamap_study_hide_conflicts';

export const HIDE_CONFLICTS = (() => {
  try { return localStorage.getItem(HIDE_CONFLICTS_KEY) === '1'; } catch { return false; }
})();
