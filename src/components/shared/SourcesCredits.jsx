
// Attribution for every source whose text the app shows or bundles.
// Required by CC BY-SA (Wikivoyage, Wikitravel, Wikipedia, StackExchange) and by the
// map/geodata providers. Reddit text is shown only as short linked excerpts.
export const SOURCE_CREDITS = [
  { name: 'Wikivoyage', url: 'https://en.wikivoyage.org', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { name: 'Wikitravel', url: 'https://wikitravel.org', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { name: 'Travel StackExchange', url: 'https://travel.stackexchange.com', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { name: 'Reddit', url: 'https://www.reddit.com', license: 'short excerpts, linked to the original', licenseUrl: 'https://redditinc.com/policies/user-agreement' },
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL', licenseUrl: 'https://opendatacommons.org/licenses/odbl/' },
  { name: 'Wikidata', url: 'https://www.wikidata.org', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { name: 'Esri basemaps', url: 'https://www.esri.com', license: 'Esri terms of use', licenseUrl: 'https://www.esri.com/en-us/legal/terms/full-master-agreement' },
];

export default function SourcesCredits() {
  return (
    <details style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
      <summary style={{ cursor: 'pointer' }}>Sources &amp; licenses</summary>
      <p style={{ margin: '6px 0' }}>
        Statements are sentences taken from the sources below, split and classified automatically.
        Each statement links to the page it came from. Text is used under the listed licenses.
      </p>
      <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.7 }}>
        {SOURCE_CREDITS.map(s => (
          <li key={s.name}>
            <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{s.name}</a>
            {', '}<a href={s.licenseUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{s.license}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}
