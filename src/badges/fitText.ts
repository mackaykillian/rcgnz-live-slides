import { useEffect, useState } from 'react';

const BADGE_FONTS = ['500 18px Crystal', '400 12px Crystal', '400 8px "Space Mono"'];

let loading: Promise<unknown> | null = null;

/** Load the badge fonts once — text is measured to fit, so it must be in its final font first. */
export function loadBadgeFonts(): Promise<unknown> {
  loading ??= Promise.all(BADGE_FONTS.map((font) => document.fonts.load(font).catch(() => [])));
  return loading;
}

export function useBadgeFontsReady(): boolean {
  const [ready, setReady] = useState(() => BADGE_FONTS.every((font) => document.fonts.check(font)));
  useEffect(() => {
    if (ready) return;
    let live = true;
    void loadBadgeFonts().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [ready]);
  return ready;
}

const px = (el: HTMLElement, name: string) => Number(el.dataset[name]);

/**
 * Shrink long text to fit the badge, in place (no re-render):
 * - `data-fit="line"`: one line; font shrinks from data-max to data-min px.
 * - `data-fit="lines"`: wraps to data-lines lines, then shrinks.
 * Text that still doesn't fit at the minimum size wraps rather than overflowing.
 */
export function fitBadgeText(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-fit]')) {
    const max = px(el, 'max');
    const min = px(el, 'min');
    el.style.fontSize = `${max}px`;

    if (el.dataset.fit === 'line') {
      el.style.whiteSpace = 'nowrap';
      if (el.scrollWidth <= el.clientWidth) continue;
      // Width scales linearly with font size (tracking is in em), so one step lands on the fit.
      const size = Math.max(min, Math.floor(((max * el.clientWidth) / el.scrollWidth) * 4) / 4);
      el.style.fontSize = `${size}px`;
      if (el.scrollWidth > el.clientWidth) el.style.whiteSpace = 'normal';
      continue;
    }

    const lines = px(el, 'lines');
    el.style.whiteSpace = 'normal';
    // Set after white-space: in older Chrome (e.g. 126), white-space resets text-wrap.
    el.style.setProperty('text-wrap', 'balance');
    const overflows = (size: number) =>
      el.scrollHeight > size * 1.15 * lines + 0.5 || el.scrollWidth > el.clientWidth;
    el.style.overflowWrap = 'normal';
    let size = max;
    while (size > min && overflows(size)) {
      size = Math.max(min, size - 0.25);
      el.style.fontSize = `${size}px`;
    }
    if (overflows(size)) el.style.overflowWrap = 'anywhere';
  }
}
