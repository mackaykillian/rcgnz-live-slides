import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Hover delay before a tooltip appears (the browser's own `title` waits ~1s and can't be changed). */
const SHOW_DELAY_MS = 300;
const GAP = 6;
const EDGE = 8;

interface Tip {
  text: string;
  anchor: DOMRect;
}

/**
 * App-wide tooltips. Any element with a `data-tooltip="…"` attribute gets one —
 * a single delegated listener, so it costs nothing per element. Rendered in a
 * portal above everything, so `overflow: hidden` parents (session blocks) can't
 * clip it, and it works inside the full-screen views.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;

    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const onOver = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest('[data-tooltip]') : null;
      if (el === current) return; // still inside the same target — keep the pending/visible tooltip
      hide();
      const text = el?.getAttribute('data-tooltip');
      if (!el || !text) return;
      current = el;
      timer = setTimeout(() => setTip({ text, anchor: el.getBoundingClientRect() }), SHOW_DELAY_MS);
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) hide(); // pointer left the window
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // Place above the target (below if there's no room), kept inside the window.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!tip || !box) return setPos(null);
    const { width, height } = box.getBoundingClientRect();
    const a = tip.anchor;
    const above = a.top - GAP - height;
    const top = above >= EDGE ? above : a.bottom + GAP;
    const left = Math.min(Math.max(a.left + a.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE);
    setPos({ left, top });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={boxRef}
      role="tooltip"
      className="pointer-events-none fixed z-[100] max-w-[320px] rounded-[6px] bg-ink px-[8px] py-[6px] text-[12px] leading-[1.4] font-medium whitespace-pre-line text-white shadow-[0_4px_16px_rgba(2,14,30,0.35)] ring-1 ring-white/15"
      style={pos ?? { left: -9999, top: -9999 }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
