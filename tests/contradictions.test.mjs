import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainText, aspectsOf, extractConditions, explainByConditions, candidatePairs, classifyPair, summarizeVerified } from '../src/knowledge/contradictions.js';

const node = (id, place, claim, sourceType, sentiment = 'neutral') => ({ id, place, claim, source: { sourceType }, evaluation: { sentiment } });

test('aspects', () => {
  assert.deepEqual(aspectsOf('The Louvre is always crowded').includes('crowds'), true);
  assert.deepEqual(aspectsOf('Tickets are expensive'), ['price', 'opening']);
});

test('conditions', () => {
  assert.equal(extractConditions('Very crowded in summer').season, 'summer');
  assert.equal(extractConditions('Go early in the morning').timeOfDay, 'early morning');
  assert.equal(extractConditions('Great with kids').traveller, 'families');
  assert.equal(extractConditions('Nothing special').season, undefined);
});

test('conditions explain a disagreement', () => {
  const a = node('a', 'X', 'The Louvre is packed in summer.', 'reddit');
  const b = node('b', 'X', 'The Louvre is quiet in winter.', 'wikivoyage');
  assert.equal(explainByConditions(a, b).dimension, 'season');
  const c = node('c', 'X', 'The Louvre is packed.', 'reddit');
  assert.equal(explainByConditions(c, b), null);
});

test('candidate pairs need different sources and a shared aspect', () => {
  const nodes = [
    node('1', 'Paris · Transport', 'The metro is fast and cheap.', 'reddit', 'positive'),
    node('2', 'Paris · Transport', 'The metro is expensive and slow.', 'wikivoyage', 'negative'),
    node('3', 'Paris · Transport', 'The metro is cheap.', 'reddit', 'positive'),          // same source as 1
    node('4', 'Paris · Transport', 'Napoleon built many bridges.', 'wikipedia'),           // no shared aspect
  ];
  const pairs = candidatePairs(nodes);
  const ids = pairs.map((p) => [p.a.id, p.b.id].sort().join('-'));
  assert.ok(ids.includes('1-2'));
  assert.ok(!ids.includes('1-3'));
  assert.ok(!ids.some((x) => x.includes('4')));
});

test('classifyPair', () => {
  const a = node('a', 'X', 'Crowded in summer.', 'reddit'), b = node('b', 'X', 'Empty in winter.', 'wikivoyage');
  assert.equal(classifyPair({ contradiction: 0.9, entailment: 0.05 }, a, b).label, 'depends');
  const c = node('c', 'X', 'Always crowded.', 'reddit');
  assert.equal(classifyPair({ contradiction: 0.9, entailment: 0.05 }, c, b).label, 'contradiction');
  assert.equal(classifyPair({ contradiction: 0.1, entailment: 0.8 }, c, b).label, 'agree');
  assert.equal(classifyPair({ contradiction: 0.4, entailment: 0.3 }, c, b).label, 'unrelated');
});

test('summarizeVerified counts places', () => {
  const s = summarizeVerified([
    { placeKey: 'x', place: 'X', label: 'contradiction', scores: { contradiction: 0.9 } },
    { placeKey: 'y', place: 'Y', label: 'depends', scores: { contradiction: 0.8 } },
    { placeKey: 'z', place: 'Z', label: 'agree' },
  ]);
  assert.equal(s.contradictionPlaces, 1);
  assert.equal(s.dependsPlaces, 1);
});

test('near-identical copies across sources are not candidates', () => {
  const nodes = [
    node('1', 'X', 'It is always fun to experience the city by foot, there are numerous sights.', 'wikivoyage'),
    node('2', 'X', 'It is always fun to experience the city on foot, there are numerous sights.', 'wikitravel'),
  ];
  assert.equal(candidatePairs(nodes).length, 0);
});

test('plainText strips markup', () => {
  assert.equal(plainText("**Paris:** '''TER''' trains"), 'Paris: TER trains');
});
