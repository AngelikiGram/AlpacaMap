import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credibility, freshness, UNKNOWN_AGE_FACTOR } from '../src/knowledge/credibility.js';
import { buildPlaceEvidence, findEvidence, normalizeName } from '../src/knowledge/evidence.js';
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
    n('1', 'Louvre Museum', 'reddit', 'positive'), n('2', 'Louvre Museum', 'wikivoyage', 'positive'), n('3', 'Louvre Museum', 'wikipedia', 'neutral'),
    n('4', 'Tiny Cafe', 'reddit', 'positive'),
    n('5', 'Paris · Transport', 'reddit', 'negative'),
  ];
  const verified = { pairs: [] };
  const m = buildPlaceEvidence(nodes, verified);
  assert.equal(m.get('louvre museum').level, 'solid');
  assert.equal(m.get('tiny cafe').level, 'thin');
  assert.equal(m.has(normalizeName('Paris · Transport')), false);
  const disputed = buildPlaceEvidence(nodes, { pairs: [{ placeKey: 'louvre museum', place: 'Louvre Museum', label: 'contradiction', aId: '1', bId: '2' }] });
  assert.equal(disputed.get('louvre museum').level, 'disputed');
});

test('findEvidence matches itinerary titles', () => {
  const m = buildPlaceEvidence([n('1', 'Louvre Museum', 'reddit', 'positive')]);
  assert.equal(findEvidence('Visit the Louvre Museum', m)?.place, 'Louvre Museum');
  assert.equal(findEvidence('Hotel check-in', m), null);
});

test('relevance uses the traveller profile', () => {
  const a = { claim: 'Great for kids, very safe.' }, b = { claim: 'Pickpockets everywhere.' };
  const r = pairRelevance({ aspects: ['safety'] }, a, b, { group: 'family', styles: [], budget: null });
  assert.ok(r.score >= 0.8);
  assert.ok(r.reasons.includes('safety'));
  assert.equal(pairRelevance({ aspects: ['weather'] }, { claim: 'rainy' }, { claim: 'sunny' }, { group: null, styles: [] }).score, 0);
});
