import { useState, useEffect, useRef } from 'react';

import { SENTINEL_NONE } from "../../utils.jsx";
import { fetchPlaceImage, fetchImageCredit, isWikimediaImage } from "../../api.js";

export const LiveImage = ({ rec, color, icon, activeCityName }) => {
  // Only Wikimedia photos (known author and licence); older saved trips may hold other image URLs
  const cached = [rec.liveImage, rec.osmTags?.image].find(isWikimediaImage) || null;
  if (rec.liveImage && rec.liveImage !== SENTINEL_NONE && !isWikimediaImage(rec.liveImage)) rec.liveImage = null;
  const initial = cached;
  const [imgUrl, setImgUrl] = useState(initial);
  const [imgBroken, setImgBroken] = useState(false);
  const [credit, setCredit] = useState('');
  const loadCredit = () => { if (!credit && imgUrl) fetchImageCredit(imgUrl).then(c => c && setCredit(`Photo: ${c.author}, ${c.license}, Wikimedia Commons`)); };
  const fetchedRef = useRef(!!initial || rec.liveImage === SENTINEL_NONE);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchPlaceImage(rec.osmTags, rec.name, rec.type, activeCityName).then(url => {
      if (url) { rec.liveImage = url; setImgUrl(url); }
      else { rec.liveImage = SENTINEL_NONE; }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleError = () => {
    // Cached URL is broken, clear it and retry fetch
    rec.liveImage = null;
    setImgUrl(null);
    setImgBroken(false);
    fetchedRef.current = false;
    fetchPlaceImage(rec.osmTags, rec.name, rec.type, activeCityName).then(url => {
      if (url) { rec.liveImage = url; setImgUrl(url); }
      else { rec.liveImage = SENTINEL_NONE; setImgBroken(true); }
    });
  };

  if (imgUrl && !imgBroken) {
    return (
      <div style={{
        width: '46px', height: '46px', borderRadius: '8px', flexShrink: 0,
        border: `1px solid ${color}40`, boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }} title={credit || 'Photo: Wikimedia Commons'} onMouseEnter={loadCredit}>
        <img
          src={imgUrl}
          alt=""
          onError={handleError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }
  return (
    <div style={{
      width: '46px', height: '46px', borderRadius: '8px', flexShrink: 0,
      background: `linear-gradient(135deg, ${color}35, ${color}15)`,
      border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color, opacity: 0.85 }}>{icon}</div>
    </div>
  );
};
