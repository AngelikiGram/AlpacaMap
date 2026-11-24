// TravelScout user study, all wording, tasks and questionnaires.
// Edit here; study.js only renders what is defined in this file.

export const STUDY_VERSION = '2.0';

// Where the app lives relative to this page.
//  - GitHub Pages: the runner is copied to /AlpacaMap/study/  → app is one level up.
//  - npm run dev:  http://localhost:5174/user_study/runner/   → app is at the site root.
export const APP_URL = location.pathname.includes('/user_study/') ? '/' : '../';

export const CITIES = {
  paris: { slug: 'paris', name: 'Paris', full: 'Paris, France', coords: [48.8566, 2.3522] },
  rome:  { slug: 'rome',  name: 'Rome',  full: 'Rome, Italy',   coords: [41.9028, 12.4964] },
};

export const CONDITIONS = {
  S: { id: 'S', label: 'Single source', sources: ['wikivoyage'] },
  M: { id: 'M', label: 'Multi-source',  sources: null }, // null = all sources
};

// Counterbalancing by participant number (see protocol.md)
export const ORDERS = {
  1: [['S', 'paris'], ['M', 'rome']],
  2: [['S', 'rome'],  ['M', 'paris']],
  3: [['M', 'paris'], ['S', 'rome']],
  0: [['M', 'rome'],  ['S', 'paris']],
};

const likert7 = (id, text, lo, hi) => ({ id, type: 'scale', min: 1, max: 7, text, lo, hi });
const likert5 = (id, text, lo = 'Strongly disagree', hi = 'Strongly agree') => ({ id, type: 'scale', min: 1, max: 5, text, lo, hi });
const SEQ = likert7('seq', 'Overall, this task was…', 'Very difficult', 'Very easy');
const CONF = likert7('confidence', 'How confident are you in your answer?', 'Not at all', 'Completely');

export const CONSENT = {
  title: 'Consent to take part',
  html: `
    <p><b>Purpose.</b> We are evaluating TravelScout, a research prototype that collects travel information from several online sources and shows where they disagree.</p>
    <p><b>What you will do.</b> Use the app for about 30 minutes to complete short planning tasks for two cities, then answer questionnaires and a short interview (50–60 minutes in total).</p>
    <p><b>What we record.</b> Your answers, task times and the buttons and views you click inside the app. No name or e-mail is stored, only a participant number. Data stays in this browser until the facilitator exports it.</p>
    <p><b>Your rights.</b> Taking part is voluntary. You can stop at any time without giving a reason, and ask for your data to be deleted until it is anonymised.</p>
    <p><b>Use of data.</b> Anonymised results may be published and shared as an open dataset. Recordings are never published.</p>
    <p><b>Data protection.</b> Controller: Angeliki Grammatikaki (angiegram99@gmail.com).
      Legal basis: your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time. Only the study team sees the data;
      this page sends nothing to a server (the app loads maps and texts from public services, which see this computer's IP address).
      Recordings are deleted after analysis, at the latest 6 months after the session; pseudonymised answers are kept for 10 years.
      You have the right to access, correct, delete, restrict and move your data and to object (Art. 15–21 GDPR), and to complain to
      the Austrian data protection authority (Datenschutzbehörde, dsb.gv.at).</p>
    <p><b>Contact.</b> Angeliki Grammatikaki (angiegram99@gmail.com)</p>`,
  items: [
    { id: 'agree', type: 'check', text: 'I have read this information and agree to take part.', required: true },
    { id: 'adult', type: 'check', text: 'I am 18 years or older.', required: true },
    { id: 'recording', type: 'check', text: 'I agree to screen and audio recording (optional).' },
  ],
};

export const DEMOGRAPHICS = [
  { id: 'age', type: 'choice', text: 'Age group', options: ['18–24', '25–34', '35–44', '45–54', '55+'] },
  { id: 'trips', type: 'choice', text: 'How many leisure trips to an unfamiliar city have you planned in the last 3 years?', options: ['0', '1–2', '3–5', '6+'] },
  { id: 'sources', type: 'multi', text: 'Which sources do you usually use to plan a trip?', options: ['Travel guides (Wikivoyage, Lonely Planet…)', 'Forums (Reddit, TripAdvisor forums…)', 'Review sites', 'Social media', 'AI chatbots', 'Friends/family', 'Other'] },
  { id: 'visited_paris', type: 'choice', text: 'Have you visited Paris?', options: ['Yes', 'No'] },
  { id: 'visited_rome', type: 'choice', text: 'Have you visited Rome?', options: ['Yes', 'No'] },
  likert7('map_comfort', 'How comfortable are you with map-based web apps?', 'Not at all', 'Very'),
];

export const TOUR = `
  <p>The facilitator will now show you the app. Main parts:</p>
  <ul>
    <li><b>What do sources say about…</b>: topic buttons at the top of the menu (safety, transport, food …). One click shows what guides and travellers say about that topic.</li>
    <li><b>Do sources agree?</b>: the scales button on the map. Coloured dots show places where sources agree (green) or split (amber, red).</li>
    <li><b>Debates</b>: pairs of statements that may disagree; you decide.</li>
    <li><b>Explore</b>: places on the map · <b>Itinerary</b>: days and stops</li>
    <li><b>Knowledge</b>: all statements about the city, collected from travel guides and forums.</li>
  </ul>
  <p>Some information may come from one source only, some from several. Use whatever you find helpful.</p>`;

// {CITY} is replaced with the block's city name.
export const TASKS = [
  {
    id: 'T1', title: 'Getting around',
    prompt: 'What do travellers and guides say about <b>getting around (transport)</b> in {CITY}? Write one or two sentences as if advising a friend.',
    answer: [{ id: 'answer', type: 'textarea', text: 'Your advice', required: true }, CONF, SEQ],
  },
  {
    id: 'T2', title: 'Find disagreements',
    prompt: 'Find up to <b>three topics or places</b> in {CITY} where guides and travellers <b>really disagree</b>. For each, write the topic or place and what exactly they disagree about. If you cannot find any, tick the box.',
    answer: [
      { id: 'none_found', type: 'check', text: 'I could not find any disagreement.' },
      { id: 'topic1', type: 'text', text: 'Topic / place 1' }, { id: 'about1', type: 'text', text: 'What is disputed?' },
      { id: 'topic2', type: 'text', text: 'Topic / place 2' }, { id: 'about2', type: 'text', text: 'What is disputed?' },
      { id: 'topic3', type: 'text', text: 'Topic / place 3' }, { id: 'about3', type: 'text', text: 'What is disputed?' },
      CONF, SEQ,
    ],
  },
  {
    id: 'T3', title: 'Check a claim',
    prompt: 'A friend says: <i>"{CITY} is not safe for tourists."</i> Using the app, do the sources <b>agree</b> with your friend, <b>disagree</b>, give a <b>mixed</b> picture, or is there <b>no information</b>?',
    answer: [
      { id: 'verdict', type: 'choice', text: 'The sources…', options: ['agree', 'disagree', 'mixed', 'no information'], required: true },
      { id: 'reason', type: 'text', text: 'Short reason' }, CONF, SEQ,
    ],
  },
  {
    id: 'T4', title: 'Plan a day',
    prompt: 'Plan <b>one day</b> in {CITY} with <b>3–4 stops</b> in the Itinerary. Then list the stops here and say briefly why you picked them.',
    answer: [
      { id: 'stops', type: 'textarea', text: 'Your stops (one per line)', required: true },
      { id: 'why', type: 'text', text: 'Why these?' },
      { id: 'conflict_influence', type: 'choice', text: 'Did information about disagreements between sources influence your plan?', options: ['Yes', 'A bit', 'No', 'I did not see any'] },
      SEQ,
    ],
  },
];

export const TLX = [
  ['mental', 'Mental demand', 'How mentally demanding were the tasks?', 'Very low', 'Very high'],
  ['physical', 'Physical demand', 'How physically demanding were the tasks?', 'Very low', 'Very high'],
  ['temporal', 'Temporal demand', 'How hurried or rushed was the pace?', 'Very low', 'Very high'],
  ['performance', 'Performance', 'How successful were you in accomplishing what you were asked to do?', 'Perfect', 'Failure'],
  ['effort', 'Effort', 'How hard did you have to work to accomplish your level of performance?', 'Very low', 'Very high'],
  ['frustration', 'Frustration', 'How insecure, discouraged, irritated, stressed or annoyed were you?', 'Very low', 'Very high'],
].map(([id, name, text, lo, hi]) => ({ id: `tlx_${id}`, type: 'slider', min: 0, max: 100, text: `<b>${name}.</b> ${text}`, lo, hi }));

export const PAIRS = {
  perType: 2,                                   // pairs per statement type (paper, Section 3)
  types: ['practical', 'evaluative', 'norm'],
  file: 'pairs.json',                           // built by user_study/analysis/make_pairs.py
  items: [
    { id: 'disagree', type: 'choice', text: 'Do these two statements really disagree?', options: ['Yes', 'Partly', 'No'], required: true },
    { id: 'impact', type: 'scale', min: 1, max: 5, text: 'Would this disagreement change your travel plans?', lo: 'Not at all', hi: 'A lot', required: true },
    { id: 'kind', type: 'choice', text: 'What kind of statement is <b>A</b>?', options: ['An opinion or rating', 'Practical information (hours, prices, routes, rules)', 'A custom or expected behaviour', 'A historical or descriptive fact', 'Not sure'] },
  ],
};

export const SUS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
].map((text, i) => likert5(`sus${i + 1}`, text));

// View names as they appear in the app; also used to classify logged clicks.
export const VIEWS = ['Topic buttons (What do sources say about…)', 'Map panel (Do sources agree?)', 'Time lens', 'Debates', 'Place window (click on a pin)', 'Knowledge', 'Explore', 'Itinerary'];

export const INTEGRATION = [
  likert5('int_helped', 'Seeing where sources disagree helped me decide what to put in my plan.'),
  likert5('int_inside', 'I would prefer conflict information inside the planner (e.g. a warning on a stop) instead of in a separate view.'),
  likert5('int_standalone', 'I would use a tool that only shows source conflicts, without any planning features.'),
];

export const FINAL = [
  { id: 'views_open', type: 'textarea', text: 'Which views or features would you merge, simplify or remove, and why?' },
  { id: 'liked', type: 'textarea', text: 'What did you like most?' },
  { id: 'confusing', type: 'textarea', text: 'What was most confusing?' },
];
