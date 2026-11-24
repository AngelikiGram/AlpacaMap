import { useEffect, useState } from 'react';
import { fetchImageCredit } from '../../api.js';

// "Photo: Author, CC BY-SA 4.0, Wikimedia Commons" under a place photo (required by the Commons licences).
export function PhotoCredit({ url }) {
  const [credit, setCredit] = useState(null);
  useEffect(() => {
    let live = true;
    setCredit(null);
    fetchImageCredit(url).then(c => { if (live) setCredit(c); });
    return () => { live = false; };
  }, [url]);
  if (!credit) return null;
  return (
    <span className="photo-credit" title={`${credit.author}, ${credit.license}`}>
      Photo: <a href={credit.page} target="_blank" rel="noreferrer">{credit.author}, {credit.license}, Wikimedia Commons</a>
    </span>
  );
}
