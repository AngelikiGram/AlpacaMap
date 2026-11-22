import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credibility, freshness, UNKNOWN_AGE_FACTOR } from '../src/knowledge/credibility.js';
import { buildPlaceEvidence, findEvidence, distinctiveWords } from '../src/knowledge/evidence.js';
import { pairRelevance } from '../src/knowledge/relevance.js';

const n = (id, place, sourceType, sentiment, publishedAt = null, claim = 'x') => ({ id, place, claim, evaluation: { sentiment }, source: { sourceType, publishedAt } });

test('freshness: unknown date is a fixed penalty, old volatile facts decay', () => {
  assert.equal(freshness(n('1', 'X', 'reddit', 'positive')), UNKNOWN_AGE_FACTOR);
  const now = Date.parse('2026-11-01');
  const old = { ...n('2', 'X', 'reddit', 'positive', '2020-11-01'), knowledge_type: 'volatile' };
  assert.ok(freshness(old, now) < 0.1);
});

test('credibility: only other sources corroborate', () => {
  const a = n('a', 'X', 'reddit', 'positive');
  const sameSrc = [a, n('b', 'X', 'reddit', 'positive'), n('c', 'X', 'reddit', 'positive')];
  const otherSrc = [a, n('d', 'X', 'wikivoyage', 'positive'), n('e', 'X', 'stackexchange', 'positive')];
  assert.ok(credibility(a, otherSrc).score > credibility(a, sameSrc).score);
});

test('evidence levels', () => {
  const nodes = [
    n('1', 'Louvre Museum', 'reddit', 'positive', null, 'The Louvre is huge.'),
    n('2', 'Paris · Culture', 'wikivoyage', 'positive', null, 'Visit the Louvre early.'),
    n('3', 'Eiffel Tower', 'wikipedia', 'neutral', null, 'From the Eiffel Tower walk to the Louvre.'),
    n('4', 'Tiny Cafe', 'reddit', 'positive', null, 'Tiny Cafe has good coffee.'),
  ];
  const idx = buildPlaceEvidence(nodes, { pairs: [] });
  const louvre = findEvidence('Louvre Museum', idx);
  assert.equal(louvre.statements, 3);           // mentions count, not only statements filed under it
  assert.equal(louvre.level, 'solid');
  assert.equal(findEvidence('Tiny Cafe', idx).level, 'thin');
  const disputed = buildPlaceEvidence(nodes, { pairs: [{ placeKey: 'x', place: 'Louvre Museum', label: 'contradiction', aId: '1', bId: '2' }] });
  assert.equal(findEvidence('Louvre Museum', disputed).level, 'disputed');
  // a pair where only one statement is about the stop does not count
  const other = buildPlaceEvidence(nodes, { pairs: [{ placeKey: 'x', place: 'X', label: 'contradiction', aId: '1', bId: '4' }] });
  assert.notEqual(findEvidence('Louvre Museum', other).level, 'disputed');
});

test('findEvidence matches itinerary titles', () => {
  const idx = buildPlaceEvidence([n('1', 'Louvre Museum', 'reddit', 'positive', null, 'The Louvre is huge.')]);
  assert.equal(findEvidence('Visit the Louvre Museum', idx)?.statements, 1);
  assert.equal(findEvidence('Hotel check-in', idx), null);
  assert.equal(findEvidence('Flight Arrival CDG', idx), null);
  const withCity = buildPlaceEvidence([n('1', 'Zurich · Transport', 'reddit', 'positive', null, 'Zurich trams are great.')], null, { cityNames: ['Zurich, Switzerland'] });
  assert.equal(findEvidence('Train to Zurich', withCity), null);
  assert.equal(distinctiveWords('Arc de Triomphe').join(' '), 'arc triomphe');
});

test('relevance uses the traveller profile', () => {
  const a = { claim: 'Great for kids, very safe.' }, b = { claim: 'Pickpockets everywhere.' };
  const r = pairRelevance({ aspects: ['safety'] }, a, b, { group: 'family', styles: [], budget: null });
  assert.ok(r.score >= 0.8);
  assert.ok(r.reasons.includes('safety'));
  assert.equal(pairRelevance({ aspects: ['weather'] }, { claim: 'rainy' }, { claim: 'sunny' }, { group: null, styles: [] }).score, 0);
});
