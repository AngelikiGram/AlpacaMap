// Study runner: consent, demographics, two task blocks, statement pairs, questionnaires, export.
// The app runs in a same-origin iframe, so the runner can preload each condition into the app's
// storage and log clicks inside it without changing the app.
import * as C from './config.js';

const SESSION_KEY = 'ts_study_session';
const BACKUP_KEY = 'ts_study_backup';

const $ = (s) => document.querySelector(s);
const panel = $('#panel');
const frame = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const optValue = (o) => (typeof o === 'string' ? o : o.value);
const optLabel = (o) => (typeof o === 'string' ? o : o.label);

let S = load();
let currentTask = null;
const dataCache = {};

// Persistence

function load() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(S)); } catch (e) { console.warn('session save failed', e); }
}
function download(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
}

// Steps

function buildSteps(order) {
  const steps = [
    { type: 'consent' },
    { type: 'form', id: 'demographics', title: 'About you', items: C.DEMOGRAPHICS },
    { type: 'tour', title: 'App tour', html: C.TOUR },
  ];
  order.forEach(([cond, city], i) => {
    const block = i + 1;
    steps.push({ type: 'prepare', block, cond, city });
    C.TASKS.forEach((t) => steps.push({ type: 'task', block, cond, city, task: t.id }));
    steps.push({
      type: 'form', id: `tlx_b${block}`, block, title: `Workload, part ${block} of 2`, items: C.TLX,
      intro: `Think about the tasks you just did for <b>${C.CITIES[city].name}</b>. Move every slider.`,
    });
  });
  steps.push({ type: 'pairs' });
  steps.push({ type: 'form', id: 'sus', title: 'Your overall impression', intro: 'Think about the whole app.', items: C.SUS });
  steps.push({ type: 'views' });
  steps.push({ type: 'form', id: 'integration', title: 'Disagreements and planning', items: C.INTEGRATION });
  steps.push({ type: 'form', id: 'final', title: 'Last questions', items: C.FINAL });
  steps.push({ type: 'done' });
  return steps;
}

// Forms

function renderItem(q, name, v) {
  const req = q.required ? ' <span class="req">*</span>' : '';
  switch (q.type) {
    case 'check':
      return `<label class="q check" data-q="${name}"><input type="checkbox" name="${name}" ${v ? 'checked' : ''}> ${q.text}${req}</label>`;
    case 'text':
      return `<label class="q" data-q="${name}"><span>${q.text}${req}</span><input type="text" name="${name}" value="${esc(v)}"></label>`;
    case 'textarea':
      return `<label class="q" data-q="${name}"><span>${q.text}${req}</span><textarea name="${name}" rows="3">${esc(v)}</textarea></label>`;
    case 'choice':
    case 'multi': {
      const type = q.type === 'choice' ? 'radio' : 'checkbox';
      const opts = q.options.map((o) => {
        const val = optValue(o);
        const checked = Array.isArray(v) ? v.includes(val) : v === val;
        return `<label class="opt"><input type="${type}" name="${name}" value="${esc(val)}" ${checked ? 'checked' : ''}> ${optLabel(o)}</label>`;
      }).join('');
      return `<fieldset class="q" data-q="${name}"><legend>${q.text}${req}</legend><div class="opts">${opts}</div></fieldset>`;
    }
    case 'scale': {
      const pts = [];
      for (let i = q.min; i <= q.max; i++) {
        pts.push(`<label class="pt"><input type="radio" name="${name}" value="${i}" ${String(v) === String(i) ? 'checked' : ''}><span>${i}</span></label>`);
      }
      return `<fieldset class="q" data-q="${name}"><legend>${q.text}${req}</legend><div class="scale"><small>${q.lo || ''}</small>${pts.join('')}<small>${q.hi || ''}</small></div></fieldset>`;
    }
    case 'slider': {
      const touched = v != null;
      return `<fieldset class="q" data-q="${name}"><legend>${q.text}${req}</legend><div class="slider"><small>${q.lo}</small>
        <input type="range" name="${name}" min="${q.min}" max="${q.max}" step="5" value="${v ?? 50}" data-touched="${touched}"><small>${q.hi}</small></div></fieldset>`;
    }
    default:
      return '';
  }
}

function renderItems(items, prefix, values = {}) {
  return items.map((q) => renderItem(q, `${prefix}${q.id}`, values[q.id])).join('');
}

function bindSliders(root = panel) {
  root.querySelectorAll('input[type=range]').forEach((el) => {
    el.addEventListener('input', () => { el.dataset.touched = 'true'; });
  });
}

function readItem(q, els) {
  if (q.type === 'check') return !!els[0]?.checked;
  if (q.type === 'multi') return els.filter((e) => e.checked).map((e) => e.value);
  if (q.type === 'choice') return els.find((e) => e.checked)?.value ?? null;
  if (q.type === 'scale') {
    const c = els.find((e) => e.checked);
    return c ? Number(c.value) : null;
  }
  if (q.type === 'slider') return els[0]?.dataset.touched === 'true' ? Number(els[0].value) : null;
  return (els[0]?.value || '').trim();
}

function collect(items, prefix, root = panel) {
  const values = {};
  const missing = [];
  for (const q of items) {
    const name = `${prefix}${q.id}`;
    const v = readItem(q, [...root.querySelectorAll(`[name="${CSS.escape(name)}"]`)]);
    if (q.required && (v === null || v === '' || v === false)) missing.push(name);
    values[q.id] = v;
  }
  return { values, missing };
}

function showMissing(missing) {
  panel.querySelectorAll('.missing').forEach((e) => e.classList.remove('missing'));
  missing.forEach((name) => panel.querySelector(`[data-q="${CSS.escape(name)}"]`)?.classList.add('missing'));
  const msg = panel.querySelector('.error');
  if (msg) msg.textContent = missing.length ? 'Please answer the questions marked in red.' : '';
  return missing.length > 0;
}

// Layout

function setMode(mode) {
  document.body.dataset.mode = mode;
}
function header(title, sub = '') {
  const total = S.steps.length;
  const i = S.step + 1;
  return `<div class="progress"><div style="width:${Math.round((i / total) * 100)}%"></div></div>
    <div class="meta">${esc(S.pid)} · step ${i} of ${total}</div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}`;
}
function next() {
  S.step++;
  save();
  render();
}

// App storage

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
  try { backup = JSON.parse(localStorage.getItem(BACKUP_KEY)); } catch { /* no backup */ }
  clearAppStorage();
  if (backup) {
    for (const [k, v] of Object.entries(backup)) {
      try { localStorage.setItem(k, v); } catch { /* skip */ }
    }
  }
  localStorage.removeItem(BACKUP_KEY);
  clearStudyKnowledge();
}

// The app keeps statements and Debates answers in IndexedDB, one entry per trip id.
function idbRequest(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(C.APP_KG_DB.name, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(C.APP_KG_DB.store);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(C.APP_KG_DB.store, mode);
      const req = fn(tx.objectStore(C.APP_KG_DB.store));
      tx.oncomplete = () => { db.close(); resolve(req.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
function clearStudyKnowledge() {
  return Promise.all([1, 2].map((b) => idbRequest('readwrite', (s) => s.delete(`study-b${b}`)))).catch(() => null);
}

async function cityNodes(slug) {
  if (dataCache[slug]) return dataCache[slug];
  const res = await fetch(`${C.APP_URL}preprocessed/${slug}.json`);
  if (!res.ok) throw new Error(`Could not load preprocessed/${slug}.json (HTTP ${res.status})`);
  const data = await res.json();
  // Drop duplicated fields so the larger cities fit in browser storage.
  dataCache[slug] = (data.nodes || []).map((n, i) => {
    const source = { ...n.source };
    delete source.snippet;
    const node = { ...n, id: `study-${slug}-${i}`, source: { ...source, label: source.label || source.sourceLabel || source.sourceType } };
    delete node.nextPlace;
    return node;
  });
  return dataCache[slug];
}

async function seedApp(condId, citySlug, block) {
  const city = C.CITIES[citySlug];
  const cond = C.CONDITIONS[condId];
  frame.src = 'about:blank';
  await sleep(150);
  const nodes = await cityNodes(citySlug);
  clearAppStorage();
  await clearStudyKnowledge();
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
      // Marks the city's bundled statements as loaded, so the app does not load them a second time.
      knowledgeAuto: { [citySlug]: now() },
    },
  };
  localStorage.setItem(C.APP_TRIPS_KEY, JSON.stringify([trip]));
  localStorage.setItem('alpacamap_prefs_v2', JSON.stringify({ mapLayer: 'satellite' }));
  if (cond.hideConflicts) localStorage.setItem(C.APP_HIDE_CONFLICTS_KEY, '1');
  frame.src = `${C.APP_URL}?study=${block}`;
  return nodes.length;
}

// Itinerary stops and Debates answers of a block, read when T4 is submitted.
async function appState(block) {
  await sleep(1600); // the app saves 1.5 s after a change
  const id = `study-b${block}`;
  try {
    const trips = JSON.parse(localStorage.getItem(C.APP_TRIPS_KEY)) || [];
    const data = trips.find((t) => t.id === id)?.data || {};
    const kg = (await idbRequest('readonly', (s) => s.get(id)).catch(() => null)) || data.knowledgeGraph;
    return {
      stops: (data.itinerary || []).flatMap((d) => (d.events || []).map((e) => e.title)).filter(Boolean),
      debateLabels: (kg?.verified?.pairs || []).filter((p) => p.by === 'you').map((p) => ({ place: p.place, label: p.label })),
    };
  } catch {
    return null;
  }
}

// Click logging

function viewOf(el, doc) {
  for (const v of C.VIEWS) if (v.selector && el.closest(v.selector)) return v.id;
  if (el.closest('.leaflet-container')) {
    if (doc.querySelector('.lens-legend.time')) return 'time_lens';
    if (doc.querySelector('.lens-legend')) return 'map_panel';
    return 'map';
  }
  const menuItem = el.closest('.menu-item');
  const tab = menuItem
    ? menuItem.querySelector('.menu-item-label')?.firstChild?.textContent?.trim()
    : el.closest('.tab-content') && doc.querySelector('.panel-section-name')?.textContent?.trim();
  if (tab) return C.VIEWS.find((v) => v.tab === tab)?.id || `other:${tab}`;
  return el.closest('.menu-panel, .panel-back') ? 'menu' : 'other';
}

// A preloaded trip has no active city, so the conflict views stay empty. The app selects the
// first city when the knowledge overlay is switched on; switch it on and off once after loading.
async function activateCity(win, doc) {
  for (let i = 0; i < 100 && !doc.querySelector('.menu-panel'); i++) await sleep(100);
  for (const detail of [true, false]) win.dispatchEvent(new win.CustomEvent('toggle-knowledge-overlay', { detail }));
}

frame.addEventListener('load', () => {
  let doc;
  try { doc = frame.contentDocument; } catch { return; }
  if (!doc || frame.src === 'about:blank') return;
  activateCity(frame.contentWindow, doc);
  doc.addEventListener('click', (e) => {
    if (!S || !currentTask || !(e.target instanceof doc.defaultView.Element)) return;
    const el = e.target.closest('button, a, label, [role="tab"], [role="button"], input, select, summary') || e.target;
    const text = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || '').trim().split('\n')[0].slice(0, 80);
    S.log.push({ t: now(), block: currentTask.block, task: currentTask.task, view: viewOf(e.target, doc), tag: el.tagName.toLowerCase(), text });
  }, true);
});

// Statement pairs (RQ4): the same fixed set for everyone, order shuffled per participant.

function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function buildPairs() {
  const rand = rng(S.pnum * 7919 + 17);
  const data = await fetch(new URL(C.PAIRS.file, location.href)).then((r) => r.json());
  const pairs = data.pairs.map((p) => ({ id: p.id, type: p.type, typesAB: p.types_ab, city: p.city, place: p.place, a: p.a, b: p.b }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

// Screens

function renderSetup() {
  setMode('full');
  panel.innerHTML = `<h1>${C.APP_NAME} user study</h1>
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
    if (!m) {
      panel.querySelector('.error').textContent = 'Use the format P01, P02, ...';
      return;
    }
    const pnum = Number(m[1]);
    const order = C.ORDERS[pnum % 4];
    const backup = snapshotAppStorage();
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    } catch {
      download(`app_backup_${Date.now()}.json`, backup);
      alert('The backup was too large for browser storage and was downloaded as a file instead. Keep it.');
    }
    S = {
      version: C.STUDY_VERSION, pid, pnum, pilot: $('#pilot').checked, facilitator: $('#fac').value.trim(),
      startedAt: now(), userAgent: navigator.userAgent, screen: `${screen.width}x${screen.height}`,
      order: order.map(([cond, city]) => ({ cond, city })),
      steps: buildSteps(order), step: 0, answers: {}, tasks: [], pairs: null, log: [],
    };
    save();
    render();
  };
  $('#restore').onclick = () => {
    restoreAppStorage();
    alert('Your app data has been restored.');
  };
}

function renderConsent() {
  setMode('full');
  panel.innerHTML = `${header(C.CONSENT.title)}<div class="info">${C.CONSENT.html}</div>${renderItems(C.CONSENT.items, 'c_', S.answers.consent)}
    <p class="error"></p><div class="actions"><button id="decline">I do not want to take part</button><button class="primary" id="ok">Continue</button></div>`;
  $('#ok').onclick = () => {
    const { values, missing } = collect(C.CONSENT.items, 'c_');
    if (showMissing(missing)) return;
    S.answers.consent = { ...values, at: now() };
    next();
  };
  $('#decline').onclick = () => {
    S.answers.consent = { agree: false, at: now() };
    S.step = S.steps.length - 1;
    save();
    render();
  };
}

function renderForm(step) {
  setMode('full');
  panel.innerHTML = `${header(step.title, step.intro)}${renderItems(step.items, 'f_', S.answers[step.id])}
    <p class="error"></p><div class="actions"><button class="primary" id="ok">Continue</button></div>`;
  bindSliders();
  $('#ok').onclick = () => {
    const { values, missing } = collect(step.items, 'f_');
    if (showMissing(missing)) return;
    S.answers[step.id] = values;
    next();
  };
}

// The tour uses a fresh app; the facilitator opens the London example trip from the menu.
function renderTour(step) {
  setMode('split');
  if (!frame.src.includes('study=tour')) {
    clearAppStorage();
    frame.src = `${C.APP_URL}?study=tour`;
  }
  panel.innerHTML = `${header(step.title)}<div class="info">${step.html}</div><div class="actions"><button class="primary" id="ok">Continue</button></div>`;
  $('#ok').onclick = next;
}

async function renderPrepare(step) {
  setMode('full');
  const city = C.CITIES[step.city];
  const title = `Part ${step.block} of 2: ${city.name}`;
  panel.innerHTML = `${header(title)}<p class="sub">Loading the app for ${city.name}...</p><div class="spinner"></div>`;
  try {
    const count = await seedApp(step.cond, step.city, step.block);
    S.answers[`prepare_b${step.block}`] = { cond: step.cond, city: step.city, nodes: count, at: now() };
    panel.innerHTML = `${header(title)}
      <div class="info"><p>You will now do <b>four short tasks</b> about <b>${city.name}</b>. The app is open on the right.</p>
      <p>For each task: read it, press <b>Start</b>, use the app, then press <b>Done</b> and answer.</p></div>
      <div class="actions"><button class="primary" id="ok">Continue</button></div>`;
    $('#ok').onclick = next;
  } catch (e) {
    panel.innerHTML = `${header('Could not load the app data')}<p class="error">${esc(e.message)}</p><button id="retry">Try again</button>`;
    $('#retry').onclick = () => renderPrepare(step);
  }
}

function renderTask(step) {
  const t = C.TASKS.find((x) => x.id === step.task);
  const prompt = t.prompt.replaceAll('{CITY}', C.CITIES[step.city].name);
  let rec = S.tasks.find((r) => r.block === step.block && r.task === t.id);
  if (!rec) {
    rec = { block: step.block, cond: step.cond, city: step.city, task: t.id, phase: 'brief' };
    S.tasks.push(rec);
    save();
  }
  currentTask = ['working', 'answer'].includes(rec.phase) ? { block: step.block, task: t.id } : null;
  setMode(rec.phase === 'brief' ? 'split dim' : 'split');
  const title = `${t.id} · ${t.title}`;

  if (rec.phase === 'brief') {
    panel.innerHTML = `${header(title)}<div class="task">${prompt}</div><div class="actions"><button class="primary" id="go">Start</button></div>`;
    $('#go').onclick = () => {
      rec.phase = 'working';
      rec.startedAt = now();
      save();
      renderTask(step);
    };
  } else if (rec.phase === 'working') {
    panel.innerHTML = `${header(title)}<div class="task">${prompt}</div><p class="timer" id="timer"></p>
      <div class="actions"><button class="primary" id="done">Done, go to the questions</button></div>`;
    const t0 = Date.parse(rec.startedAt);
    const tick = () => {
      const el = $('#timer');
      if (!el) return;
      const s = Math.floor((Date.now() - t0) / 1000);
      el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      setTimeout(tick, 1000);
    };
    tick();
    $('#done').onclick = () => {
      rec.phase = 'answer';
      rec.doneAt = now();
      rec.seconds = Math.round((Date.parse(rec.doneAt) - t0) / 1000);
      save();
      renderTask(step);
    };
  } else {
    panel.innerHTML = `${header(title)}<div class="task small">${prompt}</div><p class="sub">You can still look at the app while answering.</p>
      ${renderItems(t.answer, 'a_', rec.answers)}<p class="error"></p><div class="actions"><button class="primary" id="ok">Submit</button></div>`;
    $('#ok').onclick = async () => {
      const { values, missing } = collect(t.answer, 'a_');
      if (showMissing(missing)) return;
      $('#ok').disabled = true;
      rec.answers = values;
      if (t.id === 'T4') rec.app = await appState(step.block);
      rec.submittedAt = now();
      rec.phase = 'submitted';
      currentTask = null;
      next();
    };
  }
}

async function renderPairs() {
  setMode('full');
  if (!S.pairs) {
    panel.innerHTML = `${header('Statement pairs')}<div class="spinner"></div>`;
    S.pairs = await buildPairs();
    S.pairIndex = 0;
    save();
  }
  const i = S.pairIndex || 0;
  if (i >= S.pairs.length) {
    next();
    return;
  }
  const p = S.pairs[i];
  panel.innerHTML = `${header(`Statement pair ${i + 1} of ${S.pairs.length}`, 'Two statements about the same topic from different sources.')}
    <div class="pair"><div class="topic">${esc(p.place)}</div>
      <div class="stmt"><b>A</b> <span class="src">${esc(p.a.source)}</span><p>${esc(p.a.claim)}</p></div>
      <div class="stmt"><b>B</b> <span class="src">${esc(p.b.source)}</span><p>${esc(p.b.claim)}</p></div></div>
    ${renderItems(C.PAIRS.items, 'p_', p.answers)}<p class="error"></p><div class="actions"><button class="primary" id="ok">Next</button></div>`;
  $('#ok').onclick = () => {
    const { values, missing } = collect(C.PAIRS.items, 'p_');
    if (showMissing(missing)) return;
    p.answers = values;
    S.pairIndex = i + 1;
    save();
    renderPairs();
  };
}

function renderViews() {
  setMode('full');
  const prev = S.answers.views || {};
  const select = (name, val) => `<select name="${name}"><option value="">-</option>${[1, 2, 3, 4, 5]
    .map((k) => `<option ${String(val) === String(k) ? 'selected' : ''}>${k}</option>`).join('')}</select>`;
  const rows = C.VIEWS.map((v) => {
    const a = prev[v.id] || {};
    return `<tr data-q="v_${v.id}"><td>${esc(v.label)}</td><td><input type="checkbox" name="v_${v.id}_used" ${a.used ? 'checked' : ''}></td>
      <td>${select(`v_${v.id}_understood`, a.understood)}</td><td>${select(`v_${v.id}_useful`, a.useful)}</td>
      <td><input type="checkbox" name="v_${v.id}_remove" ${a.remove ? 'checked' : ''}></td></tr>`;
  }).join('');
  panel.innerHTML = `${header('The app\'s views', 'Tick the views you used and rate them from 1 (not at all) to 5 (completely).')}
    <table class="views"><thead><tr><th>View</th><th>Used</th><th>Understood what it shows</th><th>Useful for the tasks</th><th>Would remove</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="error"></p><div class="actions"><button class="primary" id="ok">Continue</button></div>`;
  $('#ok').onclick = () => {
    const out = {};
    const missing = [];
    for (const v of C.VIEWS) {
      const get = (field) => panel.querySelector(`[name="v_${v.id}_${field}"]`);
      const row = {
        used: get('used').checked,
        understood: Number(get('understood').value) || null,
        useful: Number(get('useful').value) || null,
        remove: get('remove').checked,
      };
      if (row.used && (!row.understood || !row.useful)) missing.push(`v_${v.id}`);
      out[v.id] = row;
    }
    if (showMissing(missing)) return;
    S.answers.views = out;
    next();
  };
}

function exportSession() {
  download(`${S.pid}${S.pilot ? '_pilot' : ''}_session.json`, { ...S, steps: undefined, exportedAt: now() });
}

function renderDone() {
  setMode('full');
  frame.src = 'about:blank';
  S.finishedAt ||= now();
  save();
  const declined = S.answers.consent && !S.answers.consent.agree;
  panel.innerHTML = `${header(declined ? 'Session ended' : 'Thank you!')}
    <p class="sub">${declined ? 'No data will be used. Please hand the computer back to the facilitator.' : 'You are finished. Please hand the computer back to the facilitator for a short interview.'}</p>
    <details class="fac" open><summary>Facilitator</summary>
      <ol><li>Export the session and copy the file to <code>user_study/data/</code>.</li><li>Then end the session. This restores your own app data on this computer.</li></ol>
      <div class="actions"><button class="primary" id="export">Export session (JSON)</button><button id="end">End session &amp; restore app data</button></div>
    </details>`;
  $('#export').onclick = () => {
    if (declined) alert('Participant declined, nothing to export.');
    else exportSession();
    S.exported = true;
    save();
  };
  $('#end').onclick = () => {
    if (!declined && !S.exported && !confirm('The session has not been exported. End anyway? The data will be lost.')) return;
    restoreAppStorage();
    localStorage.removeItem(SESSION_KEY);
    S = null;
    location.reload();
  };
}

const SCREENS = {
  consent: renderConsent, form: renderForm, tour: renderTour, prepare: renderPrepare, task: renderTask,
  pairs: renderPairs, views: renderViews, done: renderDone,
};

function render() {
  if (!S) return renderSetup();
  window.scrollTo(0, 0);
  panel.scrollTop = 0;
  const step = S.steps[S.step];
  return SCREENS[step.type](step);
}

// Ctrl+Shift+E exports at any time, in case something breaks mid-session.
document.addEventListener('keydown', (e) => {
  if (S && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') exportSession();
});

// After a reload during a task, the app has to be loaded again.
if (S?.steps[S.step]?.type === 'task') frame.src = `${C.APP_URL}?study=${S.steps[S.step].block}`;
render();
