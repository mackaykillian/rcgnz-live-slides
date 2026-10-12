import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsOut } from '@phosphor-icons/react';
import { Slide } from '../../slides/Slide';
import { SlideFrame } from '../../slides/SlideFrame';
import { templateById } from '../../slides/templates';
import type { ResolvedDeck } from '../../slideshows/deck';
import { Presenter } from './Presenter';
import { useSlideKeys } from './useSlideKeys';

interface Props {
  deck: ResolvedDeck;
  /** Entry key of the current slide (from the URL); first slide when null/unknown. */
  slideKey: string | null;
  onSlideKey: (key: string) => void;
}

/** Figma: "View | Grand Ballroom" — large preview with a scrollable filmstrip, plus full-screen mode. */
export function DeckView({ deck, slideKey, onSlideKey }: Props) {
  const { items } = deck;
  const found = items.findIndex((item) => item.key === slideKey);
  const index = found < 0 ? 0 : found;
  const current = items[index];

  const [presenting, setPresenting] = useState(false);
  const thumbRefs = useRef(new Map<string, HTMLButtonElement>());

  const go = useCallback(
    (i: number) => {
      const target = items[Math.max(0, Math.min(items.length - 1, i))];
      if (target && target.key !== current?.key) onSlideKey(target.key);
    },
    [items, current, onSlideKey],
  );
  const keys = {
    prev: useCallback(() => go(index - 1), [go, index]),
    next: useCallback(() => go(index + 1), [go, index]),
    first: useCallback(() => go(0), [go]),
    last: useCallback(() => go(items.length - 1), [go, items.length]),
  };
  useSlideKeys(keys, { presenting });

  // Keep the current thumbnail in view as you step through the deck.
  useEffect(() => {
    if (current) thumbRefs.current.get(current.key)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [current]);

  // Leaving browser fullscreen (Esc, or the browser's own UI) ends the presentation.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Browsers without the Fullscreen API (iOS Safari) still get the overlay; Esc closes it.
  useEffect(() => {
    if (!presenting || document.fullscreenElement) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPresenting(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting]);

  const enterFullscreen = () => {
    setPresenting(true);
    // Must run inside the click handler — browsers only allow fullscreen from a user gesture.
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exitFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else setPresenting(false);
  };

  if (items.length === 0) {
    return <p className="flex h-full items-center justify-center text-[14px] text-white/60">No sessions in this room yet.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-[24px]">
      <div className="flex shrink-0 items-center justify-between text-[14px] leading-[1.5] text-white">
        <span className="text-white/60" aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <button type="button" onClick={enterFullscreen} className="flex items-center gap-[6px] hover:text-white/70">
          <ArrowsOut size={16} />
          Enter fullscreen
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[16px]">
        {/* Fit the 16:9 preview inside whatever space is left. */}
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div className="w-[min(100cqw,calc(100cqh*16/9))] overflow-hidden rounded-[8px]">
            {current && (
              <SlideFrame>
                <Slide item={current.slide} />
              </SlideFrame>
            )}
          </div>
        </div>

        <div className="-mx-[12px] flex shrink-0 gap-[9px] overflow-x-auto px-[12px] pb-[4px]" role="listbox" aria-label="Slides">
          {items.map((item, i) => {
            const active = i === index;
            const label = templateById[item.slide.template].label;
            return (
              <button
                key={item.key}
                ref={(el) => {
                  if (el) thumbRefs.current.set(item.key, el);
                  else thumbRefs.current.delete(item.key);
                }}
                type="button"
                role="option"
                aria-selected={active}
                title={item.slide.session ? `${item.slide.title} — ${label}` : label}
                onClick={() => go(i)}
                className="flex w-[124px] shrink-0 flex-col gap-[8px] rounded-[8px] p-[12px] text-left hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <div className="relative w-[100px] overflow-hidden rounded-[6px]">
                  <SlideFrame>
                    <Slide item={item.slide} />
                  </SlideFrame>
                  {active && <span className="pointer-events-none absolute inset-0 rounded-[6px] border-4 border-accent" />}
                </div>
                <span className="w-full truncate text-[14px] leading-none text-white">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {presenting && <Presenter items={items} index={index} onExit={exitFullscreen} />}
    </div>
  );
}
