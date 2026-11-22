// Statement quality filters shared by the app and the preprocessing scripts.

// Common function words; English text has many of them, other languages almost none.
const EN = new Set('the a an and or but of to in on at for with from by is are was were be been it this that these those you your we our they their there here not no do does did can will would should could have has had as if so than then just very also more most only about into out up down over after before when where which who what how all any some'.split(' '));
const NON_EN = new Set('der die das und ist nicht sie ihre ihr mit für auf den dem des ein eine einen zu von im sich wir lesen entdecken le la les et est une des du pour dans avec pas il elle sont el los las y es por con para una del que su sus di il che non sono per della delle het een en van op met voor niet zijn'.split(' '));

/** Rough language check: true when the text is (most likely) English. */
export function isEnglish(text) {
  const words = (text || '').toLowerCase().match(/[a-zà-ÿäöüß]+/g) || [];
  if (words.length < 4) return true; // too short to judge — let other filters decide
  let en = 0, other = 0;
  for (const w of words) { if (EN.has(w)) en++; else if (NON_EN.has(w)) other++; }
  return en >= 2 && en >= other * 1.5;
}

// Website chrome, adverts, cookie banners and similar non-claims
const BOILERPLATE = [
  /\b(cookie|cookies|privacy policy|terms of (use|service)|all rights reserved|sign up|log in|subscribe|newsletter)\b/i,
  /\b(click here|read more|see more|book now|buy now|order now|download (the|our) app)\b/i,
  /\b(read reviews|see photos|compare prices|best price guarantee|free cancellation)\b/i,
  /^(posted|edited|deleted|removed|archived)\b/i,
  /^\W*$/,
];
export const isBoilerplate = (text) => BOILERPLATE.some((re) => re.test(text || ''));

/** True when a statement is worth keeping as knowledge. */
export function isUsefulClaim(text) {
  const t = (text || '').trim();
  if (t.length < 25 || t.length > 400) return false;
  if (/\?\s*$/.test(t)) return false; // questions are not claims
  if (!isEnglish(t) || isBoilerplate(t)) return false;
  if ((t.match(/[a-z]/gi) || []).length < t.length * 0.6) return false; // mostly symbols/numbers
  return true;
}

/** Shorten long excerpts (used for Reddit, where only short quotations are redistributed). */
export function excerpt(text, max = 280) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, '')) + ' …';
}

/** Place names that are obviously not places (foreign phrases, UI text). */
export function isJunkPlace(name) {
  const n = (name || '').trim();
  if (!n) return true;
  if (n.includes(' · ')) return false; // topic label, not a place name
  const words = n.toLowerCase().match(/[a-zà-ÿäöüß]+/g) || [];
  if (words.some((w) => NON_EN.has(w) && !EN.has(w))) return true;
  return /^(click|read|see|book|sign|log)\b/i.test(n);
}
