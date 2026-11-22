// Language model running inside the browser with WebGPU (WebLLM).
// Lets the Planner work without installing Ollama. The model is downloaded once
// (about 0.9–2 GB depending on the choice) and cached by the browser.

export const BROWSER_MODELS = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 1.5B (≈1 GB, good at JSON)' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 1B (≈0.9 GB, fastest)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 3B (≈2 GB, best quality)' },
];
export const DEFAULT_BROWSER_MODEL = BROWSER_MODELS[0].id;

export const hasWebGPU = () => typeof navigator !== 'undefined' && !!navigator.gpu;

let current = { id: null, promise: null };

/** Loads (or reuses) the engine. onProgress({ text, progress 0–1 }). */
export function getBrowserEngine(modelId = DEFAULT_BROWSER_MODEL, onProgress) {
  if (current.id === modelId && current.promise) return current.promise;
  if (!hasWebGPU()) return Promise.reject(new Error('This browser has no WebGPU. Use a recent Chrome or Edge, or use Ollama.'));
  current = {
    id: modelId,
    promise: (async () => {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      return CreateMLCEngine(modelId, { initProgressCallback: (p) => onProgress?.({ text: p.text, progress: p.progress }) });
    })(),
  };
  current.promise.catch(() => { current = { id: null, promise: null }; });
  return current.promise;
}

export const isBrowserModelLoaded = (modelId) => current.id === modelId && !!current.promise;

/**
 * fetch()-compatible stand-in for Ollama's /api/chat, backed by the browser model.
 * Returns a Response whose body is Ollama-style NDJSON ({"message":{"content":…}} per line),
 * so the Planner's existing streaming code works unchanged.
 */
export async function browserChatFetch(init, { modelId, onProgress } = {}) {
  const req = JSON.parse(init?.body || '{}');
  const engine = await getBrowserEngine(modelId, onProgress);
  const params = {
    messages: req.messages || [],
    max_tokens: req.options?.num_predict || 1024,
    temperature: req.options?.temperature ?? 0.7,
    ...(req.format === 'json' ? { response_format: { type: 'json_object' } } : {}),
  };
  const enc = new TextEncoder();
  if (!req.stream) {
    const r = await engine.chat.completions.create(params);
    return new Response(JSON.stringify({ message: { role: 'assistant', content: r.choices?.[0]?.message?.content || '' }, done: true }), { headers: { 'content-type': 'application/json' } });
  }
  const chunks = await engine.chat.completions.create({ ...params, stream: true });
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          if (init?.signal?.aborted) { engine.interruptGenerate?.(); break; }
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(enc.encode(JSON.stringify({ message: { role: 'assistant', content: delta } }) + '\n'));
        }
        controller.enqueue(enc.encode(JSON.stringify({ done: true }) + '\n'));
        controller.close();
      } catch (e) { controller.error(e); }
    },
  });
  return new Response(body, { headers: { 'content-type': 'application/x-ndjson' } });
}
