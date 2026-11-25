// TravelScout user study runner.
// Runs the whole session: consent → demographics → 2 task blocks → statement pairs →
// questionnaires → export. The app is embedded in an iframe on the same origin, so the
// runner can preload each condition into the app's storage and log clicks inside it
// without any change to the app itself.
import * as C from './config.js';

const SESSION_KEY = 'ts_study_session';
const BACKUP_KEY = 'ts_study_backup';
const APP_TRIPS_KEY = 'alpacamap_trips_v1';

const $ = (s) => document.querySelector(s);
const panel = $('#panel');
const frame = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

let S = load() || null;           // session state
let dataCache = {};               // city slug → slimmed nodes
let currentTask = null;           // for log tagging

// ───────────────────────── persistence ─────────────────────────
function load() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function save() { try { localStorage.setItem(SESSION_KEY, JSON.stringify(S)); } catch (e) { console.warn('session save failed', e); } }
function download(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = name; a.click();
}

// ───────────────────────── steps ─────────────────────────
function buildSteps(order) {
  const steps = [{ type: 'consent' }, { type: 'form', id: 'demographics', title: 'About you', items: C.DEMOGRAPHICS }, { type: 'info', id: 'tour', title: 'App tour', html: C.TOUR }];
  order.forEach(([cond, city], b) => {
    const block = b + 1;
    steps.push({ type: 'prepare', block, cond, city });
    C.TASKS.forEach((t) => steps.push({ type: 'task', block, cond, city, task: t.id }));
    steps.push({ type: 'form', id: `tlx_b${block}`, block, title: `Workload, part ${block} of 2`, intro: 'Think about the tasks you just did for <b>' + C.CITIES[city].name + '</b>.', items: C.TLX });
  });
  steps.push({ type: 'pairs' });
  steps.push({ type: 'form', id: 'sus', title: 'Your overall impression', intro: 'Think about the whole app.', items: C.SUS });
  steps.push({ type: 'views' });
  steps.push({ type: 'form', id: 'integration', title: 'Disagreements and planning', items: C.INTEGRATION });
  steps.push({ type: 'form', id: 'final', title: 'Last questions', items: C.FINAL });
  steps.push({ type: 'done' });
  return steps;
}

// ───────────────────────── form rendering ─────────────────────────
function renderItems(items, prefix, values = {}) {
  return items.map((q) => {
    const name = `${prefix}${q.id}`;
    const v = values[q.id];
    const req = q.required ? ' <span class="req">*</span>' : '';
    if (q.type === 'check') return `<label class="q check"><input type="checkbox" name="${name}" ${v ? 'checked' : ''}> ${q.text}${req}</label>`;
    if (q.type === 'text') return `<label class="q"><span>${q.text}${req}</span><input type="text" name="${name}" value="${esc(v)}"></label>`;
    if (q.type === 'textarea') return `<label class="q"><span>${q.text}${req}</span><textarea name="${name}" rows="3">${esc(v)}</textarea></label>`;
    if (q.type === 'choice' || q.type === 'multi') {
      const t = q.type === 'choice' ? 'radio' : 'checkbox';
      const opts = q.options.map((o) => `<label class="opt"><input type="${t}" name="${name}" value="${esc(o)}" ${(Array.isArray(v) ? v.includes(o) : v === o) ? 'checked' : ''}> ${o}</label>`).join('');
      return `<fieldset class="q"><legend>${q.text}${req}</legend><div class="opts">${opts}</div></fieldset>`;
    }
    if (q.type === 'scale') {
      const opts = [];
      for (let i = q.min; i <= q.max; i++) opts.push(`<label class="pt"><input type="radio" name="${name}" value="${i}" ${String(v) === String(i) ? 'checked' : ''}><span>${i}</span></label>`);
      // One row of equal cells; the end labels sit under the first and last value
      return `<fieldset class="q"><legend>${q.text}${req}</legend><div class="scale" style="--n:${q.max - q.min + 1}"><div class="scale-points">${opts.join('')}</div><div class="scale-ends" aria-hidden="true"><small>${q.lo || ''}</small><small>${q.hi || ''}</small></div></div></fieldset>`;
    }
    if (q.type === 'slider') {
      return `<fieldset class="q"><legend>${q.text}</legend><div class="slider"><small>${q.lo}</small><input type="range" name="${name}" min="${q.min}" max="${q.max}" step="5" value="${v ?? 50}" data-touched="${v != null}"><small>${q.hi}</small></div></fieldset>`;
    }
    return '';
  }).join('');
}

function collect(items, prefix, root = panel) {
  const out = {}; const missing = [];
  for (const q of items) {
    const name = `${prefix}${q.id}`;
    const els = [...root.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
    let v;
    if (q.type === 'check') v = !!els[0]?.checked;
    else if (q.type === 'multi') v = els.filter((e) => e.checked).map((e) => e.value);
    else if (q.type === 'choice') v = els.find((e) => e.checked)?.value ?? null;
    else if (q.type === 'scale') { const c = els.find((e) => e.checked); v = c ? Number(c.value) : null; }
    else if (q.type === 'slider') v = Number(els[0]?.value);
    else v = (els[0]?.value || '').trim();
    if (q.required && (v === null || v === '' || v === false)) missing.push(q);
    out[q.id] = v;
  }
  return { values: out, missing };
}

function showMissing(missing) {
  panel.querySelectorAll('.missing').forEach((e) => e.classList.remove('missing'));
  if (!missing.length) return false;
  const msg = panel.querySelector('.error'); if (msg) msg.textContent = 'Please answer the questions marked with *.';
  return true;
}

// ───────────────────────── layout helpers ─────────────────────────
function setMode(mode) {   // 'full' = questionnaire only, 'split' = task + app, 'hidden-app'
  document.body.dataset.mode = mode;
}
function header(title, sub = '') {
  const total = S.steps.length; const i = S.step + 1;
  return `<div class="progress"><div style="width:${Math.round((i / total) * 100)}%"></div></div>
    <div class="meta">${esc(S.pid)} · step ${i} of ${total}</div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}`;
}
function next() { S.step++; save(); render(); }

// ───────────────────────── app control ─────────────────────────
function snapshotAppStorage() {
  const keep = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k.startsWith('ts_study')) keep[k] = localStorage.getItem(k);
  }
  return keep;
}
function clearAppStorage() {
  for (const k of Object.keys(localStorage)) if (!k.startsWith('ts_study')) localStorage.removeItem(k);
  sessionStorage.clear();
}
function restoreAppStorage() {
  let backup = null;
  try { backup = JSON.parse(localStorage.getItem(BACKUP_KEY)); } catch { /* ignore */ }
  clearAppStorage();
  if (backup) for (const [k, v] of Object.entries(backup)) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  localStorage.removeItem(BACKUP_KEY);
}

async function cityNodes(slug) {
  if (dataCache[slug]) return dataCache[slug];
  const res = await fetch(`${C.APP_URL}preprocessed/${slug}.json`);
  if (!res.ok) throw new Error(`Could not load preprocessed/${slug}.json (HTTP ${res.status})`);
  const data = await res.json();
  // Drop duplicated fields so the larger cities fit in browser storage
  dataCache[slug] = (data.nodes || []).map((n, i) => {
    const { snippet, ...source } = n.source || {};
    const { nextPlace, ...rest } = n;
    return { ...rest, id: `study-${slug}-${i}`, source: { ...source, label: source.label || source.sourceLabel || source.sourceType } };
  });
  return dataCache[slug];
}

async function seedApp(condId, citySlug, block) {
  const city = C.CITIES[citySlug];
  const cond = C.CONDITIONS[condId];
  frame.src = 'about:blank';
  await sleep(150);
  const all = await cityNodes(citySlug);
  const nodes = cond.sources ? all.filter((n) => cond.sources.includes(n.source?.sourceType)) : all;
  clearAppStorage();
  const trip = {
    id: `study-b${block}`,
    title: `Trip to ${city.name}`,
    lastModified: now(),
    data: {
      title: `Trip to ${city.name}`,
      locations: [{ id: 1, name: city.full, coords: city.coords, zoomLevel: 13, places: [], recommendations: [] }],
      routes: [],
      itinerary: [{ id: 1, date: '2026-09-10', location: city.name, events: [] }],
      notes: { general: '', cities: {} },
      documents: { flights: [], trains: [], hotels: [], leisure: [] },
      budget: { total: 0, currency: 'EUR', expenses: [] },
      packing: [],
      knowledgeGraph: { nodes, edges: [], lastUpdated: now() },
    },
  };
  localStorage.setItem(APP_TRIPS_KEY, JSON.stringify([trip]));
  localStorage.setItem('alpacamap_prefs_v2', JSON.stringify({ mapLayer: 'satellite' }));
  frame.src = `${C.APP_URL}?study=${block}`;
  return nodes.length;
}

// Log clicks inside the app (same origin → we can listen on its document)
frame.addEventListener('load', () => {
  let doc;
  try { doc = frame.contentDocument; } catch { return; }
  if (!doc || frame.src === 'about:blank') return;
  doc.addEventListener('click', (e) => {
    if (!S || !currentTask) return;
    const el = e.target.closest('button, a, label, [role="tab"], [role="button"], input, select, summary') || e.target;
    const text = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.innerText || el.value || '').trim().split('\n')[0].slice(0, 80);
    S.log.push({ t: now(), block: currentTask.block, task: currentTask.task, tag: el.tagName?.toLowerCase(), text });
  }, true);
});

// ───────────────────────── statement pairs (RQ4) ─────────────────────────
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Pairs come from a fixed file (pairs.json, built by analysis/make_pairs.py with the paper's candidate-pair rules
// and statement types), so every participant sees real, pre-checked pairs; the draw is seeded per participant.
async function buildPairs() {
  const rand = rng(S.pnum * 7919 + 17);
  const data = await fetch(new URL(C.PAIRS.file, location.href)).then((r) => r.json());
  const pairs = []; const used = new Set();
  for (const type of C.PAIRS.types) {
    const pool = (data.types?.[type] || []).slice();
    for (let k = 0; k < C.PAIRS.perType && pool.length; k++) {
      let idx, guard = 0;
      do { idx = Math.floor(rand() * pool.length); guard++; } while (used.has(pool[idx].place) && guard < 50);
      const c = pool.splice(idx, 1)[0];
      used.add(c.place);
      pairs.push({ id: `pair${pairs.length + 1}`, claimType: type, statementTypes: c.types_ab, city: c.city, place: c.place, aspects: c.aspects, a: c.a, b: c.b });
    }
  }
  // shuffle so types are not in blocks
  for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
  return pairs;
}

// ───────────────────────── screens ─────────────────────────
function renderSetup() {
  setMode('full');
  panel.innerHTML = `<h1>TravelScout user study</h1>
    <p class="sub">Facilitator setup. Enter the participant number before handing over the computer.</p>
    <label class="q"><span>Participant number (e.g. P01)</span><input id="pid" type="text" placeholder="P01" autocomplete="off"></label>
    <label class="q"><span>Facilitator initials (optional)</span><input id="fac" type="text"></label>
    <label class="q check"><input id="pilot" type="checkbox"> Pilot session (excluded from analysis)</label>
    <p class="error"></p>
    <button class="primary" id="start">Start session</button>
    <details class="fac"><summary>Facilitator tools</summary>
      <p>Data is stored only in this browser until you export it. The app's saved trips on this computer are backed up when a session starts and restored at the end.</p>
      <button id="restore">Restore my own app data now</button>
    </details>`;
  $('#start').onclick = () => {
    const pid = $('#pid').value.trim().toUpperCase();
    const m = pid.match(/^P(\d{1,3})$/);
    if (!m) { panel.querySelector('.error').textContent = 'Use the format P01, P02, …'; return; }
    const pnum = Number(m[1]);
    const order = C.ORDERS[pnum % 4];
    // back up the app's own data on this computer
    const backup = snapshotAppStorage();
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(backup)); }
    catch { download(`app_backup_${Date.now()}.json`, backup); alert('Backup was too large for browser storage and was downloaded as a file instead. Keep it.'); }
    S = {
      version: C.STUDY_VERSION, pid, pnum, pilot: $('#pilot').checked, facilitator: $('#fac').value.trim(),
      startedAt: now(), userAgent: navigator.userAgent, screen: `${screen.width}x${screen.height}`,
      order: order.map(([cond, city]) => ({ cond, city })),
      steps: buildSteps(order), step: 0, answers: {}, tasks: [], pairs: null, log: [],
    };
    save(); render();
  };
  $('#restore').onclick = () => { restoreAppStorage(); alert('Your app data has been restored.'); };
}

function renderConsent() {
  setMode('full');
  panel.innerHTML = `${header(C.CONSENT.title)}<div class="info">${C.CONSENT.html}</div>${renderItems(C.CONSENT.items, 'c_', S.answers.consent)}
    <p class="error"></p><div class="actions"><button id="decline">I do not want to take part</button><button class="primary" id="ok">Continue</button></div>`;
  $('#ok').onclick = () => {
    const { values, missing } = collect(C.CONSENT.items, 'c_');
    if (showMissing(missing)) return;
    S.answers.consent = { ...values, at: now() }; next();
  };
  $('#decline').onclick = () => { S.answers.consent = { agree: false, at: now() }; S.step = S.steps.length - 1; save(); render(); };
}

function renderForm(step) {
  setMode('full');
  panel.innerHTML = `${header(step.title, step.intro)}${renderItems(step.items, 'f_', S.answers[step.id])}
    <p class="error"></p><div class="actions"><button class="primary" id="ok">Continue</button></div>`;
  $('#ok').onclick = () => {
    const { values, missing } = collect(step.items, 'f_');
    if (showMissing(missing)) return;
    S.answers[step.id] = values; next();
  };
}

function renderInfo(step) {
  setMode('full');
  panel.innerHTML = `${header(step.title)}<div class="info">${step.html}</div><div class="actions"><button class="primary" id="ok">Continue</button></div>`;
  $('#ok').onclick = next;
}

async function renderPrepare(step) {
  setMode('full');
  const city = C.CITIES[step.city];
  panel.innerHTML = `${header(`Part ${step.block} of 2: ${city.name}`)}<p class="sub">Loading the app for ${city.name}…</p><div class="spinner"></div>`;
  try {
    const count = await seedApp(step.cond, step.city, step.block);
    S.answers[`prepare_b${step.block}`] = { cond: step.cond, city: step.city, nodes: count, at: now() };
    panel.innerHTML = `${header(`Part ${step.block} of 2: ${city.name}`)}
      <div class="info"><p>You will now do <b>four short tasks</b> about <b>${city.name}</b>. The app is open on the right.</p>
      <p>For each task: read it, press <b>Start</b>, use the app, then press <b>I'm done</b> and answer.</p></div>
      <div class="actions"><button class="primary" id="ok">Continue</button></div>`;
    $('#ok').onclick = next;
  } catch (e) {
    panel.innerHTML = `${header('Could not load the app data')}<p class="error">${esc(e.message)}</p><button id="retry">Try again</button>`;
    $('#retry').onclick = () => renderPrepare(step);
  }
}

function renderTask(step) {
  const t = C.TASKS.find((x) => x.id === step.task);
  const city = C.CITIES[step.city];
  const prompt = t.prompt.replaceAll('{CITY}', city.name);
  let rec = S.tasks.find((r) => r.block === step.block && r.task === t.id);
  if (!rec) { rec = { block: step.block, cond: step.cond, city: step.city, task: t.id, phase: 'brief' }; S.tasks.push(rec); save(); }
  currentTask = rec.phase === 'working' || rec.phase === 'answer' ? { block: step.block, task: t.id } : null;
  setMode(rec.phase === 'brief' ? 'split dim' : 'split');
  const title = `${t.id} · ${t.title}`;
  if (rec.phase === 'brief') {
    panel.innerHTML = `${header(title)}<div class="task">${prompt}</div><div class="actions"><button class="primary" id="go">Start</button></div>`;
    $('#go').onclick = () => { rec.phase = 'working'; rec.startedAt = now(); save(); renderTask(step); };
  } else if (rec.phase === 'working') {
    panel.innerHTML = `${header(title)}<div class="task">${prompt}</div><p class="timer" id="timer"></p>
      <div class="actions"><button class="primary" id="done">Done, go to the questions</button></div>`;
    const t0 = Date.parse(rec.startedAt);
    const tick = () => { const el = $('#timer'); if (!el) return; const s = Math.floor((Date.now() - t0) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; setTimeout(tick, 1000); };
    tick();
    $('#done').onclick = () => { rec.phase = 'answer'; rec.doneAt = now(); rec.seconds = Math.round((Date.parse(rec.doneAt) - t0) / 1000); save(); renderTask(step); };
  } else {
    panel.innerHTML = `${header(title)}<div class="task small">${prompt}</div><p class="sub">You can still look at the app while answering.</p>
      ${renderItems(t.answer, 'a_', rec.answers)}<p class="error"></p><div class="actions"><button class="primary" id="ok">Submit</button></div>`;
    $('#ok').onclick = () => {
      const { values, missing } = collect(t.answer, 'a_');
      if (showMissing(missing)) return;
      rec.answers = values; rec.submittedAt = now(); rec.phase = 'submitted'; currentTask = null; next();
    };
  }
}

async function renderPairs() {
  setMode('full');
  if (!S.pairs) {
    panel.innerHTML = `${header('Statement pairs')}<div class="spinner"></div>`;
    S.pairs = await buildPairs(); S.pairIndex = 0; save();
  }
  const i = S.pairIndex || 0;
  if (i >= S.pairs.length) { next(); return; }
  const p = S.pairs[i];
  panel.innerHTML = `${header(`Statement pair ${i + 1} of ${S.pairs.length}`, 'Two statements about the same topic from different sources.')}
    <div class="pair"><div class="topic">${esc(p.place)}</div>
      <div class="stmt"><b>A</b> <span class="src">${esc(p.a.source)}</span><p>${esc(p.a.claim)}</p></div>
      <div class="stmt"><b>B</b> <span class="src">${esc(p.b.source)}</span><p>${esc(p.b.claim)}</p></div></div>
    ${renderItems(C.PAIRS.items, 'p_', p.answers)}<p class="error"></p><div class="actions"><button class="primary" id="ok">Next</button></div>`;
  $('#ok').onclick = () => {
    const { values, missing } = collect(C.PAIRS.items, 'p_');
    if (showMissing(missing)) return;
    p.answers = values; S.pairIndex = i + 1; save(); renderPairs();
  };
}

function renderViews() {
  setMode('full');
  const prev = S.answers.views || {};
  const rows = C.VIEWS.map((v, i) => {
    const a = prev[v] || {};
    const sel = (name, max, val) => `<select name="v${i}_${name}"><option value="">-</option>${Array.from({ length: max }, (_, k) => `<option ${String(val) === String(k + 1) ? 'selected' : ''}>${k + 1}</option>`).join('')}</select>`;
    return `<tr><td>${esc(v)}</td><td><input type="checkbox" name="v${i}_used" ${a.used ? 'checked' : ''}></td>
      <td>${sel('understood', 5, a.understood)}</td><td>${sel('useful', 5, a.useful)}</td><td><input type="checkbox" name="v${i}_remove" ${a.remove ? 'checked' : ''}></td></tr>`;
  }).join('');
  panel.innerHTML = `${header('The app\'s views', 'Tick the views you used. For those, rate from 1 (not at all) to 5 (completely).')}
    <table class="views"><thead><tr><th>View</th><th>Used</th><th>Understood what it shows</th><th>Useful for the tasks</th><th>Would remove</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="actions"><button class="primary" id="ok">Continue</button></div>`;
  $('#ok').onclick = () => {
    const out = {};
    C.VIEWS.forEach((v, i) => {
      const g = (n) => panel.querySelector(`[name="v${i}_${n}"]`);
      out[v] = { used: g('used').checked, understood: Number(g('understood').value) || null, useful: Number(g('useful').value) || null, remove: g('remove').checked };
    });
    S.answers.views = out; next();
  };
}

function exportSession() {
  const out = { ...S, steps: undefined, exportedAt: now() };
  download(`${S.pid}${S.pilot ? '_pilot' : ''}_session.json`, out);
}

function renderDone() {
  setMode('full');
  frame.src = 'about:blank';
  S.finishedAt ||= now(); save();
  const declined = S.answers.consent && !S.answers.consent.agree;
  panel.innerHTML = `${header(declined ? 'Session ended' : 'Thank you!')}
    <p class="sub">${declined ? 'No data will be used. Please hand the computer back to the facilitator.' : 'You are finished. Please hand the computer back to the facilitator for a short interview.'}</p>
    <details class="fac" open><summary>Facilitator</summary>
      <ol><li>Export the session and copy the file to <code>user_study/data/</code>.</li><li>Then end the session, this restores your own app data on this computer.</li></ol>
      <div class="actions"><button class="primary" id="export">Export session (JSON)</button><button id="end">End session &amp; restore app data</button></div>
    </details>`;
  $('#export').onclick = () => { if (!declined) exportSession(); else alert('Participant declined, nothing to export.'); S.exported = true; save(); };
  $('#end').onclick = () => {
    if (!declined && !S.exported && !confirm('The session has not been exported. End anyway? The data will be lost.')) return;
    restoreAppStorage(); localStorage.removeItem(SESSION_KEY); S = null; location.reload();
  };
}

function render() {
  if (!S) return renderSetup();
  const step = S.steps[S.step];
  window.scrollTo(0, 0); panel.scrollTop = 0;
  ({
    consent: renderConsent, form: renderForm, info: renderInfo, prepare: renderPrepare, task: renderTask,
    pairs: renderPairs, views: renderViews, done: renderDone,
  })[step.type](step);
}

// Facilitator shortcut: Ctrl+Shift+E exports at any time (in case something breaks mid-session)
document.addEventListener('keydown', (e) => { if (S && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') exportSession(); });

// Resuming a session after a reload: a block in progress needs its app reloaded
if (S && ['task'].includes(S.steps[S.step]?.type)) {
  const st = S.steps[S.step];
  frame.src = `${C.APP_URL}?study=${st.block}`;
}
render();
