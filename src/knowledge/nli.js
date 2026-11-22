// Natural-language-inference model running in the browser (transformers.js, WebAssembly).
// For a pair (A, B) it returns probabilities for contradiction / entailment / neutral.
// The library and model are loaded only when first used: ~45 MB download, then cached by the browser.

export const NLI_MODEL = 'Xenova/nli-deberta-v3-xsmall';

let loading = null;

/** Loads tokenizer + model once. onProgress({ stage, progress }) receives download progress (0–100). */
export function loadNli(onProgress) {
  loading ||= (async () => {
    const T = await import('@huggingface/transformers');
    T.env.allowLocalModels = false;
    const progress_callback = (p) => {
      if (p?.status === 'progress' && typeof p.progress === 'number') onProgress?.({ stage: 'download', file: p.file, progress: p.progress });
    };
    const tokenizer = await T.AutoTokenizer.from_pretrained(NLI_MODEL, { progress_callback });
    const model = await T.AutoModelForSequenceClassification.from_pretrained(NLI_MODEL, { dtype: 'q8', progress_callback });
    const id2label = Object.fromEntries(Object.entries(model.config.id2label || {}).map(([k, v]) => [k, String(v).toLowerCase()]));
    return { tokenizer, model, id2label };
  })();
  loading.catch(() => { loading = null; }); // allow retry after a failure
  return loading;
}

const softmax = (row) => {
  const m = Math.max(...row);
  const e = row.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

/**
 * Scores [{ premise, hypothesis }] pairs. Returns [{ contradiction, entailment, neutral }].
 * Runs in small batches and yields to the UI between them; onProgress(done, total).
 */
export async function scorePairs(pairs, { onProgress, batchSize = 8, signal } = {}) {
  const { tokenizer, model, id2label } = await loadNli();
  const out = [];
  for (let i = 0; i < pairs.length; i += batchSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = pairs.slice(i, i + batchSize);
    const inputs = tokenizer(batch.map((p) => p.premise), { text_pair: batch.map((p) => p.hypothesis), padding: true, truncation: true, max_length: 256 });
    const { logits } = await model(inputs);
    const [rows, cols] = logits.dims;
    const data = Array.from(logits.data);
    for (let r = 0; r < rows; r++) {
      const probs = softmax(data.slice(r * cols, (r + 1) * cols));
      const res = { contradiction: 0, entailment: 0, neutral: 0 };
      probs.forEach((p, c) => { const label = id2label[c]; if (label in res) res[label] = p; });
      out.push(res);
    }
    onProgress?.(Math.min(i + batchSize, pairs.length), pairs.length);
    await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
  }
  return out;
}

/**
 * NLI is directional: score A→B and B→A and keep the *weaker* contradiction and entailment, so a pair
 * only counts when the model is confident in both directions. (Keeping the stronger one let unrelated
 * pairs through: small NLI models often call unrelated sentences a contradiction in one direction.)
 */
export async function scoreSymmetric(pairs, opts = {}) {
  const both = pairs.flatMap((p) => [{ premise: p.a, hypothesis: p.b }, { premise: p.b, hypothesis: p.a }]);
  const total = both.length;
  const scores = await scorePairs(both, { ...opts, onProgress: (d) => opts.onProgress?.(Math.floor(d / 2), total / 2) });
  return pairs.map((_, i) => {
    const x = scores[2 * i], y = scores[2 * i + 1];
    const contradiction = Math.min(x.contradiction, y.contradiction);
    const entailment = Math.min(x.entailment, y.entailment);
    return { contradiction, entailment, neutral: Math.max(0, 1 - contradiction - entailment) };
  });
}

/** Self-test on known examples; throws if the model's labels look wrong. */
export async function calibrate(examples) {
  const scores = await scoreSymmetric(examples.map((e) => ({ a: e.a, b: e.b })));
  const results = examples.map((e, i) => {
    const s = scores[i];
    const got = s.contradiction > s.entailment && s.contradiction > 0.5 ? 'contradiction' : s.entailment > 0.5 ? 'entailment' : 'neutral';
    return { ...e, got, scores: s };
  });
  const failed = results.filter((r) => r.got !== r.expect);
  if (failed.length) throw new Error(`model self-test failed (${failed.map((f) => `expected ${f.expect}, got ${f.got}`).join('; ')})`);
  return results;
}
