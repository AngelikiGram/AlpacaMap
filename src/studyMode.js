// The user study runner (user_study/runner) opens the app with ?study=<block>. In study mode the
// participant works on the trip the runner prepared: the destination is fixed, no other knowledge is
// loaded automatically (it would mix sources across conditions), and the tour and example trip are hidden.
export const STUDY_MODE = (() => {
  try { return new URLSearchParams(window.location.search).has('study'); } catch { return false; }
})();
