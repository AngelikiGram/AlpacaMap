// One small entry point to "the AI", whatever the Planner is set to use:
// the in-browser model (WebLLM, WebGPU) or a local Ollama server. Same settings as the Planner tab.
import { ollamaChatUrl } from '../endpoints';
import { DEFAULT_BROWSER_MODEL, hasWebGPU, browserChatFetch, isBrowserModelLoaded } from './browserLLM';

const isLocalHost = () => typeof location !== 'undefined' && /localhost|127\.0\.0\.1/.test(location.hostname);

export function aiSettings() {
  const provider = localStorage.getItem('ai_provider') || (!isLocalHost() ? 'browser' : 'ollama');
  return {
    provider,
    browserModel: localStorage.getItem('browser_model') || DEFAULT_BROWSER_MODEL,
    ollamaEndpoint: localStorage.getItem('ollama_endpoint') || 'http://localhost:11434',
    ollamaModel: localStorage.getItem('ollama_model') || 'llama3.1',
  };
}

/**
 * What the AI can do right now in this browser:
 *  { usable, provider, needsDownload, reason }
 * On the hosted site without WebGPU (Safari, Firefox, older devices) nothing can run.
 */
export function aiStatus() {
  const s = aiSettings();
  if (s.provider === 'browser') {
    if (!hasWebGPU()) return { usable: false, provider: 'browser', reason: 'This browser cannot run the AI model (no WebGPU). Use a recent Chrome or Edge. Everything else in AlpacaMap works without AI.' };
    return { usable: true, provider: 'browser', needsDownload: !isBrowserModelLoaded(s.browserModel) };
  }
  return { usable: true, provider: 'ollama', needsDownload: false, reason: isLocalHost() ? null : 'Uses Ollama on this computer, which must be running.' };
}

/** Sends chat messages, returns the reply text. onProgress gets model download progress (browser model). */
export async function aiComplete(messages, { json = false, maxTokens = 600, temperature = 0.6, onProgress } = {}) {
  const s = aiSettings();
  const body = JSON.stringify({ model: s.ollamaModel, messages, stream: false, ...(json ? { format: 'json' } : {}), options: { num_predict: maxTokens, temperature } });
  const res = s.provider === 'browser'
    ? await browserChatFetch({ method: 'POST', body }, { modelId: s.browserModel, onProgress })
    : await fetch(ollamaChatUrl(s.ollamaEndpoint), { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const data = await res.json();
  return data?.message?.content || '';
}
