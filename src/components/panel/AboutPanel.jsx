import { SOURCE_CREDITS } from '../shared/SourcesCredits';

// About, privacy notice (GDPR Art. 13) and imprint (Austrian ECG §5 / MedienG §25).
// Fill in OPERATOR before publishing the site: an imprint needs a postal address and an e-mail address.
// Keep THIRD_PARTIES in sync with the hosts the app calls (grep "https://" in src/).
export const OPERATOR = {
  name: 'Angeliki Grammatikaki',
  organisation: '',
  address: '',        // private, non-commercial site (MedienG §25 "small website"): name and town are enough, e.g. 'Vienna, Austria'
  email: 'angiegram99@gmail.com',
  purpose: 'Non-commercial research prototype: a travel planner that shows where travel sources disagree.',
};

const THIRD_PARTIES = [
  ['Esri (ArcGIS Online)', 'Map tiles', 'https://www.esri.com/en-us/privacy/overview'],
  ['OpenStreetMap Nominatim', 'Searching for a city or address', 'https://osmfoundation.org/wiki/Privacy_Policy'],
  ['Overpass API (overpass-api.de, kumi.systems, private.coffee)', 'Loading places around the map view', 'https://overpass-api.de/'],
  ['OSRM demo server', 'Walking and driving routes', 'https://project-osrm.org/'],
  ['Open-Meteo', 'Weather forecast and climate', 'https://open-meteo.com/en/terms'],
  ['Wikimedia (Wikipedia, Wikivoyage, Wikidata, Commons)', 'Place descriptions, travel guide text and photos', 'https://foundation.wikimedia.org/wiki/Policy:Privacy_policy'],
  ['Stack Exchange API', 'Traveller questions and answers (only when you collect live knowledge)', 'https://stackoverflow.com/legal/privacy-policy'],
  ['PullPush and DuckDuckGo', 'Finding Reddit threads (only when you collect live knowledge)', 'https://duckduckgo.com/privacy'],
  ['Hugging Face', 'Downloading the language models that run in your browser (only when you use them)', 'https://huggingface.co/privacy'],
];

const STORED = [
  'your trips, places, itinerary, budget, packing lists, notes and documents',
  'settings: theme, planner preferences, chosen AI model, judgements you made in Debates',
  'whether you have already seen the welcome and intro cards',
];

export function AboutPanel() {
  const o = OPERATOR;
  return (
    <div className="about-panel">
      <section>
        <h3>About AlpacaMap</h3>
        <p>{o.purpose} It is provided as is, without any guarantee. Travel information changes; check official sources
          before relying on it, especially for safety, health, entry rules and opening hours.</p>
      </section>

      <section>
        <h3>Automatic analysis</h3>
        <p>Statements are sentences taken from the sources listed below. Topics, sentiment, the coloured dots,
          “opinions split” and “possible contradiction” labels and AI planner texts are <b>generated automatically</b>{' '}
          and can be wrong. They are not checked by a person.</p>
      </section>

      <section>
        <h3>Privacy</h3>
        <p><b>No account, no cookies, no analytics, no advertising.</b> AlpacaMap has no server of its own: everything you
          enter stays in your browser’s local storage on this device:</p>
        <ul>{STORED.map(s => <li key={s}>{s}</li>)}</ul>
        <p>This storage is needed for the functions you use and is not read by us. You can delete it at any time by
          clearing this site’s data in your browser.</p>
        <p>To show maps, places, weather and source texts, your browser requests them directly from the services below.
          Like every web request, these requests include your <b>IP address</b> and browser details, and for searches
          the place name you typed. The services process this under their own privacy policies. The site itself is
          hosted on GitHub Pages (GitHub Inc.), which also receives your IP address when you load the page.</p>
        <ul>
          {THIRD_PARTIES.map(([name, what, url]) => (
            <li key={name}><a href={url} target="_blank" rel="noreferrer">{name}</a>: {what}</li>
          ))}
        </ul>
        <p>Legal basis: Art. 6(1)(f) GDPR (showing the content you request). You have the right to access, rectification,
          erasure, restriction and objection, and the right to lodge a complaint with a supervisory authority
          (in Austria: Datenschutzbehörde, <a href="https://www.dsb.gv.at" target="_blank" rel="noreferrer">dsb.gv.at</a>).</p>
      </section>

      <section>
        <h3>Sources, photos and licences</h3>
        <ul>
          {SOURCE_CREDITS.map(s => (
            <li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>,{' '}
              <a href={s.licenseUrl} target="_blank" rel="noreferrer">{s.license}</a></li>
          ))}
          <li>Place photos: Wikimedia Commons; author and licence are shown with each photo.</li>
          <li>Fonts: Inter, Outfit and Caveat, SIL Open Font License 1.1 (served from this site).</li>
        </ul>
      </section>

      <section>
        <h3>Imprint</h3>
        <p>
          {o.name}{o.organisation && <><br />{o.organisation}</>}
          {o.address && <><br />{o.address}</>}
          {o.email && <><br /><a href={`mailto:${o.email}`}>{o.email}</a></>}
        </p>
        <p>Purpose of this website: {o.purpose}</p>
      </section>
    </div>
  );
}
