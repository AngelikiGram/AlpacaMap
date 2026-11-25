// Study content: wording, tasks and questionnaires. study.js only renders what is defined here.

export const STUDY_VERSION = '4.0';
export const APP_NAME = 'AlpacaMap';

// GitHub Pages serves the runner at /AlpacaMap/study/, npm run dev at /user_study/runner/.
export const APP_URL = location.pathname.includes('/user_study/') ? '/' : '../';
export const APP_TRIPS_KEY = 'alpacamap_trips_v1';
export const APP_KG_DB = { name: 'travelscout', store: 'knowledge' };
export const APP_HIDE_CONFLICTS_KEY = 'alpacamap_study_hide_conflicts'; // read by src/studyMode.js

export const CITIES = {
  paris: { slug: 'paris', name: 'Paris', full: 'Paris, France', coords: [48.8566, 2.3522] },
  rome: { slug: 'rome', name: 'Rome', full: 'Rome, Italy', coords: [41.9028, 12.4964] },
};

// Both conditions show all sources; N hides the views that show where sources disagree.
export const CONDITIONS = {
  N: { id: 'N', label: 'No conflict views', hideConflicts: true },
  M: { id: 'M', label: 'Conflict views', hideConflicts: false },
};

// Participant number mod 4 -> [condition, city] per block (protocol.md).
export const ORDERS = {
  1: [['N', 'paris'], ['M', 'rome']],
  2: [['N', 'rome'], ['M', 'paris']],
  3: [['M', 'paris'], ['N', 'rome']],
  0: [['M', 'rome'], ['N', 'paris']],
};

const scale = (id, text, min, max, lo, hi, required = true) => ({ id, type: 'scale', min, max, text, lo, hi, required });
const likert5 = (id, text) => scale(id, text, 1, 5, 'Strongly disagree', 'Strongly agree');
const SEQ = scale('seq', 'Overall, this task was...', 1, 7, 'Very difficult', 'Very easy');
const CONF = scale('confidence', 'How confident are you in your answer?', 1, 7, 'Not at all', 'Completely');

export const CONSENT = {
  title: 'Consent to take part',
  html: `
    <p><b>Purpose.</b> We are evaluating ${APP_NAME} (called TravelScout in our publications), a research prototype that collects travel information from several online sources and shows where they disagree.</p>
    <p><b>What you will do.</b> Use the app for about 30 minutes to complete short planning tasks for two cities, then answer questionnaires and a short interview (50 to 60 minutes in total).</p>
    <p><b>What we record.</b> Your answers, task times and the buttons and views you click inside the app. No name or e-mail is stored, only a participant number. Data stays in this browser until the facilitator exports it.</p>
    <p><b>Risks and benefits.</b> There are no known risks beyond normal computer use. You will not benefit directly, but you help improve tools for trip planning.</p>
    <p><b>Your rights.</b> Taking part is voluntary. You can stop at any time without giving a reason, and ask for your data to be deleted until it is anonymised.</p>
    <p><b>Use of data.</b> Anonymised results may be published and shared as an open dataset. Recordings are never published.</p>
    <p><b>Data protection.</b> Controller: Angeliki Grammatikaki (angiegram99@gmail.com).
      Legal basis: your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time. Only the study team sees the data;
      this page sends nothing to a server (the app loads maps and texts from public services, which see this computer's IP address).
      Recordings are deleted after analysis, at the latest 6 months after the session; pseudonymised answers are kept for 10 years.
      You have the right to access, correct, delete, restrict and move your data and to object (Art. 15 to 21 GDPR), and to complain to
      the Austrian data protection authority (Datenschutzbehörde, dsb.gv.at).</p>
    <p><b>Contact.</b> Angeliki Grammatikaki (angiegram99@gmail.com)</p>`,
  items: [
    { id: 'agree', type: 'check', text: 'I have read this information and agree to take part.', required: true },
    { id: 'adult', type: 'check', text: 'I am 18 years or older.', required: true },
    { id: 'recording', type: 'check', text: 'I agree to screen and audio recording (optional).' },
  ],
};

const YES_NO = ['Yes', 'No'];

export const DEMOGRAPHICS = [
  { id: 'age', type: 'choice', text: 'Age group', options: ['18-24', '25-34', '35-44', '45-54', '55+'], required: true },
  { id: 'gender', type: 'choice', text: 'Gender (optional)', options: ['Woman', 'Man', 'Non-binary', 'Prefer not to say'] },
  { id: 'english', type: 'choice', text: 'How well do you read English?', options: ['Native', 'Fluent', 'Good', 'Basic'], required: true },
  { id: 'trips', type: 'choice', text: 'How many leisure trips to an unfamiliar city have you planned in the last 3 years?', options: ['0', '1-2', '3-5', '6+'], required: true },
  { id: 'sources', type: 'multi', text: 'Which sources do you usually use to plan a trip?', options: ['Travel guides (Wikivoyage, Lonely Planet...)', 'Forums (Reddit, TripAdvisor forums...)', 'Review sites', 'Social media', 'AI chatbots', 'Friends/family', 'Other'] },
  { id: 'lived_paris', type: 'choice', text: 'Have you ever lived in Paris?', options: YES_NO, required: true },
  { id: 'lived_rome', type: 'choice', text: 'Have you ever lived in Rome?', options: YES_NO, required: true },
  { id: 'visited_paris', type: 'choice', text: 'Have you visited Paris?', options: YES_NO, required: true },
  { id: 'visited_rome', type: 'choice', text: 'Have you visited Rome?', options: YES_NO, required: true },
  scale('map_comfort', 'How comfortable are you with map-based web apps?', 1, 7, 'Not at all', 'Very'),
];

export const TOUR = `
  <p>The facilitator will now show you the app on the right, using an example trip to London. Main parts:</p>
  <ul>
    <li><b>What do sources say about...</b>: topic buttons at the top of the menu (Safety &amp; Health, Transport, Food &amp; Drink, Money &amp; Costs, Climate, Nightlife). One click shows what the sources say about that topic.</li>
    <li><b>Do sources agree?</b>: a panel on the map. Coloured dots show places where sources agree (green) or split (amber, red).</li>
    <li><b>Place window</b>: click a place on the map to see what is said about it.</li>
    <li><b>Time lens</b>: what is open, closed or busy at a chosen hour.</li>
    <li><b>Debates</b>: pairs of statements that may disagree; you decide.</li>
    <li><b>Knowledge</b>: all statements about the city, collected from travel guides and forums.</li>
    <li><b>Explore</b>: places on the map. <b>Itinerary</b>: days and stops.</li>
  </ul>
  <p>Some information may come from one source only, some from several. Use whatever you find helpful.</p>`;

// {CITY} is replaced with the city of the block.
export const TASKS = [
  {
    id: 'T1', title: 'Costs',
    prompt: 'What do the sources in the app say about <b>costs and prices</b> in {CITY}? Write one or two sentences as if advising a friend.',
    answer: [{ id: 'answer', type: 'textarea', text: 'Your advice', required: true }, CONF, SEQ],
  },
  {
    id: 'T2', title: 'Find disagreements',
    prompt: 'Find up to <b>three topics or places</b> in {CITY} where the sources in the app <b>really disagree</b>: they say opposite things about the same point, so both cannot be true. Different opinions about different aspects do not count. For each, write the topic or place and what exactly is disputed. If you find none, tick the box.',
    answer: [
      { id: 'none_found', type: 'check', text: 'I could not find any real disagreement.' },
      { id: 'topic1', type: 'text', text: 'Topic or place 1' }, { id: 'about1', type: 'text', text: 'What is disputed?' },
      { id: 'topic2', type: 'text', text: 'Topic or place 2' }, { id: 'about2', type: 'text', text: 'What is disputed?' },
      { id: 'topic3', type: 'text', text: 'Topic or place 3' }, { id: 'about3', type: 'text', text: 'What is disputed?' },
      CONF, SEQ,
    ],
  },
  {
    id: 'T3', title: 'Check a claim',
    prompt: 'A friend says: <i>"{CITY} is not safe for tourists."</i> Using the app, what do the sources say about this claim?',
    answer: [
      {
        id: 'verdict', type: 'choice', text: 'The sources...', required: true,
        options: [
          { value: 'agree', label: 'mostly support your friend' },
          { value: 'disagree', label: 'mostly contradict your friend' },
          { value: 'mixed', label: 'are mixed: some support, some contradict' },
          { value: 'no information', label: 'say nothing about it' },
        ],
      },
      { id: 'reason', type: 'text', text: 'Short reason', required: true }, CONF, SEQ,
    ],
  },
  {
    id: 'T4', title: 'Plan a day',
    prompt: 'Plan <b>one day</b> in {CITY} with <b>3 to 4 stops</b> in the Itinerary. Then say briefly why you picked them.',
    answer: [
      { id: 'why', type: 'textarea', text: 'Why these stops?', required: true },
      { id: 'conflict_influence', type: 'choice', text: 'Did information about disagreements between sources influence your plan?', options: ['Yes', 'A bit', 'No', 'I did not see any'], required: true },
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
].map(([id, name, text, lo, hi]) => ({ id: `tlx_${id}`, type: 'slider', min: 0, max: 100, text: `<b>${name}.</b> ${text}`, lo, hi, required: true }));

const KIND = [
  { value: 'evaluative', label: 'An opinion or rating' },
  { value: 'practical', label: 'Practical information (hours, prices, routes, rules)' },
  { value: 'norm', label: 'A custom or expected behaviour' },
  { value: 'descriptive', label: 'A historical or descriptive fact' },
  { value: 'unsure', label: 'Not sure' },
];

export const PAIRS = {
  file: 'pairs.json',
  items: [
    { id: 'disagree', type: 'choice', text: 'Do these two statements really disagree?', options: ['Yes', 'Partly', 'No'], required: true },
    scale('impact', 'Would this disagreement change your travel plans?', 1, 5, 'Not at all', 'A lot'),
    { id: 'kind_a', type: 'choice', text: 'What kind of statement is <b>A</b>?', options: KIND, required: true },
    { id: 'kind_b', type: 'choice', text: 'What kind of statement is <b>B</b>?', options: KIND, required: true },
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

// Views rated after the study and used to label logged clicks.
// A click counts for the first view whose selector contains the click target, or whose tab is open.
export const VIEWS = [
  { id: 'topics', label: 'Topic buttons (What do sources say about...)', selector: '.ask-chip' },
  { id: 'map_panel', label: 'Map panel (Do sources agree?)', selector: '.lens-legend:not(.time), .lens-btn[title^="Truth lens"]' },
  { id: 'time_lens', label: 'Time lens', selector: '.lens-legend.time, .lens-btn[title^="Time lens"]' },
  { id: 'place_window', label: 'Place window (click on a pin)', selector: '.info-window' },
  { id: 'debates', label: 'Debates', tab: 'Debates' },
  { id: 'knowledge', label: 'Knowledge', tab: 'Knowledge' },
  { id: 'explore', label: 'Explore', tab: 'Explore' },
  { id: 'itinerary', label: 'Itinerary', tab: 'Itinerary' },
];

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
