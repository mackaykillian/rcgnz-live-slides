import { useEffect } from 'react';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Slide navigation keys. ← / → always; with `presenting`, also Space,
 * PageUp/PageDown (what most presentation clickers send), Home and End.
 */
export function useSlideKeys(
  { prev, next, first, last }: { prev: () => void; next: () => void; first: () => void; last: () => void },
  { presenting = false, enabled = true } = {},
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const back = e.key === 'ArrowLeft' || (presenting && e.key === 'PageUp');
      const forward = e.key === 'ArrowRight' || (presenting && (e.key === ' ' || e.key === 'PageDown'));
      const action = back ? prev : forward ? next : presenting && e.key === 'Home' ? first : presenting && e.key === 'End' ? last : null;
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, first, last, presenting, enabled]);
}
