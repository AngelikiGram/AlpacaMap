import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpeningHours, isOpenAt, closedWeekdays, sunTimes } from '../src/planner/openingHours.js';
import { parsePrompt, buildQuickPlan, poiFromOsm } from '../src/planner/quickPlan.js';
import { checkStop, suggestRainSwaps, isOutdoor, isIndoor, isWetDay } from '../src/planner/tripChecks.js';
import { controversyScore, pickDisputePair, strictEvidence, buildTruthLens } from '../src/knowledge/controversy.js';
import { buildPlaceEvidence } from '../src/knowledge/evidence.js';
import { buildDebates, applyAnswer, answeredKeys, keepYourLabels } from '../src/knowledge/debates.js';
import { quickReport, bumpAspectWeight, readAspectWeights } from '../src/knowledge/travellerReports.js';
import { bundledKeyFor, mergeStatements, hasBundled } from '../src/knowledge/bundled.js';
import { pairRelevance } from '../src/knowledge/relevance.js';

const st = (id, place, src, sentiment, claim) => ({ id, place, claim, evaluation: { sentiment }, source: { sourceType: src } });

test('opening hours: ranges, days off, overnight, unknown', () => {
  const h = 'Mo-Fr 09:00-17:00; Sa 10:00-16:00; Su off';
  assert.equal(isOpenAt(h, new Date('2026-12-07T10:00:00')), true);   // Monday
  assert.equal(isOpenAt(h, new Date('2026-12-07T08:00:00')), false);
  assert.equal(isOpenAt(h, new Date('2026-12-06T12:00:00')), false);  // Sunday
  assert.deepEqual(closedWeekdays(h), [0]);
  assert.deepEqual(closedWeekdays('Tu-Su 10:00-18:00'), [1]);
  assert.equal(isOpenAt('Fr 18:00-02:00', new Date('2026-12-12T01:00:00')), true); // Saturday 1am
  assert.equal(isOpenAt('24/7', new Date()), true);
  assert.equal(parseOpeningHours('sunrise-sunset'), null);
  assert.equal(isOpenAt('by appointment', new Date()), null);
});

test('sun times are plausible for London in December and Paris in June', () => {
  const ld = sunTimes(51.5, -0.12, new Date('2026-12-21T12:00:00'));
  assert.ok(ld.sunrise > 7 * 60 + 50 && ld.sunrise < 8 * 60 + 15, `London sunrise ${ld.sunrise}`);
  assert.ok(ld.sunset > 15 * 60 + 45 && ld.sunset < 16 * 60 + 10, `London sunset ${ld.sunset}`);
  const pa = sunTimes(48.86, 2.35, new Date('2026-06-21T12:00:00'));
  assert.ok(pa.sunset > 21 * 60 + 45 && pa.sunset < 22 * 60 + 5, `Paris sunset ${pa.sunset}`);
});

test('prompt parser understands days, city, budget, likes and dislikes', () => {
  const p = parsePrompt('3 days in Paris, hate queues, love food, €800', { today: new Date('2026-11-22') });
  assert.equal(p.cityKey, 'paris'); assert.equal(p.days, 3); assert.equal(p.budget, 800); assert.equal(p.currency, 'EUR');
  assert.deepEqual(p.likes, ['food']); assert.deepEqual(p.avoid, ['crowds']);
  const q = parsePrompt('A relaxed weekend in Lisbon with my partner, no museums, $1.2k', { today: new Date('2026-11-22') });
  assert.equal(q.cityKey, 'lisbon'); assert.equal(q.days, 2); assert.equal(q.group, 'couple'); assert.equal(q.pace, 'relaxed');
  assert.ok(q.avoid.includes('culture')); assert.equal(q.budget, 1200); assert.equal(q.currency, 'USD');
  const r = parsePrompt('5 nights visiting Ljubljana in March', { today: new Date('2026-11-22') });
  assert.equal(r.cityQuery, 'Ljubljana'); assert.equal(r.days, 6); assert.equal(r.startDate, '2027-03-10');
});

const osm = (id, lat, lon, tags) => ({ id, lat, lon, tags });
test('quick plan: liked categories first, lunch nearby, closed days avoided', () => {
  const els = [
    osm(1, 51.5194, -0.1270, { tourism: 'museum', name: 'British Museum', wikidata: 'Q6373', opening_hours: 'Mo-Su 10:00-17:00' }),
    osm(2, 51.5205, -0.1300, { tourism: 'museum', name: 'Closed Monday Museum', wikidata: 'Q1', opening_hours: 'Tu-Su 10:00-17:00' }),
    osm(3, 51.5180, -0.1260, { amenity: 'restaurant', name: 'Lunch Place', website: 'x' }),
    osm(4, 51.5170, -0.1290, { leisure: 'park', name: 'Russell Square' }),
    osm(5, 51.5160, -0.1280, { tourism: 'gallery', name: 'Small Gallery' }),
  ];
  const pois = els.map(poiFromOsm).filter(Boolean);
  const p = parsePrompt('1 day in London, love museums');
  const plan = buildQuickPlan(p, { pois, center: [51.5194, -0.127], startDate: '2026-12-07' }); // a Monday
  const names = plan.days[0].stops.map((s) => s.name);
  assert.equal(names[0], 'British Museum');
  assert.ok(!names.includes('Closed Monday Museum'), names.join(','));
  assert.ok(names.includes('Lunch Place'));
});

test('trip checks: OSM closed day, source says closed, crowds at that time', () => {
  const w1 = checkStop({ title: 'X', date: '2026-12-07', time: '10:00', place: { hours: 'Tu-Su 10:00-18:00' } });
  assert.equal(w1[0].kind, 'closed-day');
  const ev = { statementsList: [st('1', 'Louvre', 'wikivoyage', 'neutral', 'The Louvre is closed on Tuesdays.')] };
  assert.equal(checkStop({ title: 'Louvre', date: '2026-12-08', time: '11:00', evidence: ev })[0].kind, 'closed-day');
  const ev2 = { statementsList: [st('2', 'Louvre', 'reddit', 'negative', 'The Louvre is really crowded in the afternoon, long queues.')] };
  assert.equal(checkStop({ title: 'Louvre', date: '2026-12-09', time: '14:30', evidence: ev2 })[0].kind, 'crowds');
  assert.equal(checkStop({ title: 'Louvre', date: '2026-12-09', time: '09:30', evidence: ev2 }).length, 0);
});

test('rain plan swaps an outdoor stop for a nearby indoor one', () => {
  assert.ok(isOutdoor({ name: 'Hyde Park', type: 'park' })); assert.ok(isIndoor({ name: 'Science Museum', type: 'museum' }));
  assert.ok(isWetDay({ precipProb: 80 })); assert.ok(!isWetDay({ precipProb: 10, code: 1 }));
  const resolve = (t) => ({ 'Hyde Park': { name: 'Hyde Park', type: 'park', coords: [51.507, -0.165] } }[t]);
  const cands = [{ name: 'Science Museum', type: 'museum', coords: [51.4978, -0.1745], osmTags: { wikidata: 'Q' } }, { name: 'Far Museum', type: 'museum', coords: [51.6, -0.1] }];
  const swaps = suggestRainSwaps([{ id: 1, title: 'Hyde Park', time: '10:00' }], resolve, cands);
  assert.equal(swaps.length, 1); assert.equal(swaps[0].to.name, 'Science Museum');
});

test('controversy: verified dispute beats opinion split; strict matching ignores generic names', () => {
  assert.ok(controversyScore({ level: 'disputed', contradictions: [1], pos: 0, neg: 0 }) > 0.8);
  assert.ok(controversyScore({ level: 'solid', pos: 6, neg: 0, sources: ['a', 'b'] }) < 0.15);
  assert.ok(controversyScore({ level: 'mixed', pos: 3, neg: 3, sources: ['a', 'b'] }) > 0.5);
  const nodes = [
    st('1', 'London · Food', 'reddit', 'positive', 'Borough Market is great value for lunch.'),
    st('2', 'London · Food', 'wikivoyage', 'negative', 'Borough Market is overpriced and crowded at lunch.'),
    st('3', 'London · General', 'wikivoyage', 'neutral', 'The market in the centre sells fish.'),
  ];
  const idx = buildPlaceEvidence(nodes, null, { cityNames: ['London'] });
  const e = strictEvidence('Borough Market', idx);
  assert.equal(e.statements, 2);
  const pair = pickDisputePair(e);
  assert.equal(pair.verified, false); assert.ok(pair.a.includes('great'));
  const lens = buildTruthLens([{ name: 'Borough Market', coords: [51.5, -0.09] }, { name: 'Market', coords: [51.5, -0.1] }], idx);
  assert.equal(lens.length, 1);
});

test('debates: answers become labels and learned aspect weights', () => {
  const nodes = [
    st('a', 'London · Money', 'wikivoyage', 'positive', 'Museums in London are free and the tube is cheap at weekends.'),
    st('b', 'London · Money', 'reddit', 'negative', 'The tube is expensive and museums charge for special exhibitions at weekends.'),
  ];
  const cards = buildDebates(nodes, null);
  assert.equal(cards.length, 1); assert.equal(cards[0].kind, 'unchecked');
  const res = applyAnswer(cards[0], 'b', null);
  assert.equal(res.verified.pairs[0].label, 'contradiction'); assert.equal(res.aspectDelta, 1);
  assert.equal(answeredKeys(res.verified).size, 1);
  assert.equal(buildDebates(nodes, res.verified, { answered: answeredKeys(res.verified) }).length, 0);
  assert.equal(keepYourLabels({ pairs: [] }, res.verified).pairs.length, 1);
  const mem = new Map(); const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  bumpAspectWeight('price', 1, storage); bumpAspectWeight('price', 1, storage);
  assert.equal(readAspectWeights(storage).price, 2);
  const rel = pairRelevance({ aspects: ['price'] }, nodes[0], nodes[1], { styles: [], aspectWeights: { price: 2 } });
  assert.ok(rel.score > 0 && rel.reasons.some((r) => r.includes('debate')));
});

test('traveller reports and bundled knowledge helpers', () => {
  const r = quickReport('crowded', 'Tower of London', 'London', new Date('2026-07-04T14:00:00'));
  assert.equal(r.source.sourceType, 'manual'); assert.equal(r.evaluation.sentiment, 'negative');
  assert.equal(r.conditions.season, 'summer'); assert.equal(r.conditions.timeOfDay, 'afternoon');
  assert.equal(bundledKeyFor('Greater London, England'), 'london'); assert.equal(bundledKeyFor('Zürich'), 'zurich'); assert.equal(bundledKeyFor('Oslo'), null);
  assert.equal(mergeStatements([st('1', 'A', 'x', 'positive', 'Same text')], [st('2', 'A', 'y', 'positive', 'Same text')]).length, 1);
  assert.ok(hasBundled([{ id: 'offline-london-3' }], 'london'));
});
