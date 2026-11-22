// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTopic } from '../src/knowledge/topics.js';
import { isEnglish, isUsefulClaim, isJunkPlace, excerpt } from '../src/knowledge/quality.js';

test('topics: clear cases', () => {
  assert.equal(classifyTopic('Watch out for pickpockets on metro line 1.'), 'Safety & Health');
  assert.equal(classifyTopic('The best croissant is at the bakery near the market.'), 'Food & Drink');
  assert.equal(classifyTopic('Buy a Navigo pass for the metro and RER trains.'), 'Transport');
  assert.equal(classifyTopic('It rains a lot in November, bring an umbrella.'), 'Climate');
  assert.equal(classifyTopic('The Romans held out here until 508 CE.'), 'History');
  assert.equal(classifyTopic('Keep your wallet in your front pocket and avoid outdoor ATMs.'), 'Safety & Health');
});

test('topics: no keyword → General', () => {
  assert.equal(classifyTopic('It was an unforgettable experience overall.'), 'General');
});

test('language filter', () => {
  assert.equal(isEnglish('Entdecken Sie fast 200 Ziele und fliegen Sie zu Ihrem nächsten Abenteuer.'), false);
  assert.equal(isEnglish('The metro is the fastest way to get around the city.'), true);
});

test('useful claims', () => {
  assert.equal(isUsefulClaim('Lesen Sie Bewertungen und sehen Sie Fotos an.'), false);
  assert.equal(isUsefulClaim('Click here to read more about our free cancellation policy.'), false);
  assert.equal(isUsefulClaim('Go to the Louvre early in the morning to avoid the queues.'), true);
  assert.equal(isUsefulClaim('Has anyone been in Paris during a metro strike?'), false);
});

test('junk place names', () => {
  assert.equal(isJunkPlace('Ihre Reise'), true);
  assert.equal(isJunkPlace('Lesen Sie Bewertungen'), true);
  assert.equal(isJunkPlace('Musée d\'Orsay'), false);
  assert.equal(isJunkPlace('Paris · Transport'), false);
});

test('excerpt keeps short text and trims long text', () => {
  assert.equal(excerpt('Short text.'), 'Short text.');
  const long = 'A'.repeat(50) + '. ' + 'b '.repeat(200);
  assert.ok(excerpt(long).length <= 284);
});
