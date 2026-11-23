// Runs the app's own NLI verification (src/knowledge/contradictions.js + nli.js logic) on the bundled
// data of all five cities, exactly as the browser does it, and writes the verdicts to analysis/out/nli_verdicts.json.
// Usage (from travel_planner/): node analysis/run_nli.mjs
import fs from 'node:fs';
import path from 'node:path';
import { candidatePairs, classifyPair, plainText, CALIBRATION } from '../src/knowledge/contradictions.js';
import { AutoTokenizer, AutoModelForSequenceClassification, env } from '@huggingface/transformers';

const NLI_MODEL = 'Xenova/nli-deberta-v3-xsmall';
env.allowLocalModels = false;
const tokenizer = await AutoTokenizer.from_pretrained(NLI_MODEL);
const model = await AutoModelForSequenceClassification.from_pretrained(NLI_MODEL, { dtype: 'q8' });
const id2label = Object.fromEntries(Object.entries(model.config.id2label).map(([k, v]) => [k, String(v).toLowerCase()]));
const softmax = (r) => { const m = Math.max(...r); const e = r.map((x) => Math.exp(x - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };

async function scorePairs(pairs, batchSize = 16) {
  const out = [];
  for (let i = 0; i < pairs.length; i += batchSize) {
    const b = pairs.slice(i, i + batchSize);
    const inputs = tokenizer(b.map((p) => p.premise), { text_pair: b.map((p) => p.hypothesis), padding: true, truncation: true, max_length: 256 });
    const { logits } = await model(inputs);
    const [rows, cols] = logits.dims; const data = Array.from(logits.data);
    for (let r = 0; r < rows; r++) {
      const probs = softmax(data.slice(r * cols, (r + 1) * cols));
      const res = { contradiction: 0, entailment: 0, neutral: 0 };
      probs.forEach((p, c) => { const l = id2label[c]; if (l in res) res[l] = p; });
      out.push(res);
    }
  }
  return out;
}
// identical to nli.js scoreSymmetric
async function scoreSymmetric(pairs) {
  const both = pairs.flatMap((p) => [{ premise: p.a, hypothesis: p.b }, { premise: p.b, hypothesis: p.a }]);
  const s = await scorePairs(both);
  return pairs.map((_, i) => {
    const x = s[2 * i], y = s[2 * i + 1];
    const contradiction = Math.min(x.contradiction, y.contradiction), entailment = Math.min(x.entailment, y.entailment);
    return { contradiction, entailment, neutral: Math.max(0, 1 - contradiction - entailment) };
  });
}

const cal = await scoreSymmetric(CALIBRATION.map((e) => ({ a: e.a, b: e.b })));
console.log('self-test', cal.map((s) => `c=${s.contradiction.toFixed(2)} e=${s.entailment.toFixed(2)}`).join(' | '));

const cities = ['london', 'paris', 'rome', 'edinburgh', 'zurich'];
const result = { model: NLI_MODEL, date: new Date().toISOString().slice(0, 10), cities: {} };
for (const c of cities) {
  const d = JSON.parse(fs.readFileSync(path.join('public', 'preprocessed', `${c}.json`), 'utf8'));
  const nodes = d.nodes.filter((n) => n.claim && n.place);
  const cand = candidatePairs(nodes);
  const scores = await scoreSymmetric(cand.map((p) => ({ a: plainText(p.a.claim), b: plainText(p.b.claim) })));
  const pairs = cand.map((p, i) => {
    const v = classifyPair(scores[i], p.a, p.b);
    return { aId: p.a.id, bId: p.b.id, place: p.place, aspects: p.aspects, label: v.label, condition: v.condition?.text || null,
      scores: scores[i], a: p.a.claim, b: p.b.claim, aSource: p.a.source?.sourceType, bSource: p.b.source?.sourceType,
      aSent: p.a.evaluation?.sentiment, bSent: p.b.evaluation?.sentiment };
  });
  const counts = pairs.reduce((m, p) => ((m[p.label] = (m[p.label] || 0) + 1), m), {});
  result.cities[d.city] = { pairs: pairs.length, counts, places: new Set(pairs.map((p) => p.place)).size, verified: pairs };
  console.log(d.city, pairs.length, JSON.stringify(counts));
}
fs.mkdirSync(path.join('analysis', 'out'), { recursive: true });
fs.writeFileSync(path.join('analysis', 'out', 'nli_verdicts.json'), JSON.stringify(result, null, 1));
