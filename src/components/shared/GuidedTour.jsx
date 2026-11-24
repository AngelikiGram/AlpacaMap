import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Step-by-step tour over the real interface. Each step runs its action (open a panel, switch a lens),
// waits for its target element, then highlights it and explains it next to it.
// steps: [{ target: CSS selector, title, text, run?: () => void }]

const PAD = 6;
const CARD_W = 300;

const findTarget = (selector) => new Promise((resolve) => {
  const started = Date.now();
  const look = () => {
    const el = selector && document.querySelector(selector);
    if (el && el.getBoundingClientRect().width > 0) return resolve(el);
    if (Date.now() - started > 2500) return resolve(null);
    setTimeout(look, 100);
  };
  look();
});

function cardPosition(rect) {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (!rect) return { left: (vw - CARD_W) / 2, top: vh / 3 };
  const clampTop = (t) => Math.max(12, Math.min(t, vh - 230));
  if (rect.right + PAD + 16 + CARD_W < vw) return { left: rect.right + PAD + 16, top: clampTop(rect.top) };
  if (rect.left - PAD - 16 - CARD_W > 0) return { left: rect.left - PAD - 16 - CARD_W, top: clampTop(rect.top) };
  const below = rect.bottom + PAD + 16;
  return { left: Math.max(12, Math.min(rect.left, vw - CARD_W - 12)), top: below + 200 < vh ? below : Math.max(12, rect.top - 230) };
}

export function GuidedTour({ steps, onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const targetRef = useRef(null);
  const nextRef = useRef(null);
  const returnFocus = useRef(document.activeElement);
  const step = steps[index];
  const last = index === steps.length - 1;

  // steps must be stable (memoised by the caller); changing step hides the card text until the target is found
  const go = useCallback((i) => { setReady(false); setIndex(i); }, []);

  const close = useCallback(() => {
    onClose();
    returnFocus.current?.focus?.();
  }, [onClose]);

  // Run the step's action, then find and highlight its target
  useEffect(() => {
    let alive = true;
    const current = steps[index];
    (async () => {
      try { await current.run?.(); } catch { /* a step that cannot run still shows its text */ }
      const el = await findTarget(current.target);
      if (!alive) return;
      targetRef.current = el;
      el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      setTimeout(() => { if (alive) { setRect(el ? el.getBoundingClientRect() : null); setReady(true); } }, 350);
    })();
    return () => { alive = false; };
  }, [index, steps]);

  // Follow the target while panels animate or the window is resized
  useLayoutEffect(() => {
    const update = () => { if (targetRef.current?.isConnected) setRect(targetRef.current.getBoundingClientRect()); };
    const timer = setInterval(update, 400);
    window.addEventListener('resize', update);
    return () => { clearInterval(timer); window.removeEventListener('resize', update); };
  }, []);

  useEffect(() => { if (ready) nextRef.current?.focus(); }, [ready]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' && !last && ready) go(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, go, index, last, ready]);

  const pos = cardPosition(ready ? rect : null);
  return createPortal(
    <div className="tour" aria-live="polite">
      <div className="tour-blocker" onClick={(e) => e.stopPropagation()} />
      {ready && rect && (
        <div className="tour-spot" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
      )}
      {ready && !rect && <div className="tour-dim" />}
      <div className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" style={{ left: pos.left, top: pos.top, width: CARD_W }}>
        <div className="tour-count">Step {index + 1} of {steps.length}</div>
        <h2 id="tour-title" className="tour-title">{step.title}</h2>
        <p className="tour-text">{ready ? step.text : 'One moment…'}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={close}>{last ? 'Close' : 'Skip tour'}</button>
          {index > 0 && <button type="button" className="tour-back" onClick={() => go(index - 1)}>Back</button>}
          <button type="button" ref={nextRef} className="tour-next" disabled={!ready}
            onClick={() => (last ? close() : go(index + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
