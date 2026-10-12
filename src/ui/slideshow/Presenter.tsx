import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowsIn } from '@phosphor-icons/react';
import { Slide } from '../../slides/Slide';
import { SlideFrame } from '../../slides/SlideFrame';
import type { DeckItem } from '../../slideshows/deck';

/** How close (px) to the top-right corner the cursor must be to reveal "Exit fullscreen". */
const CORNER = { width: 280, height: 140 };

interface Props {
  items: DeckItem[];
  index: number;
  onExit: () => void;
}

/**
 * Full-screen slide presentation (Figma: "View | Grand Ballroom | Full Screen").
 * Letterboxed on black. Esc is handled by the browser's fullscreen mode; the
 * exit button appears when the cursor nears the top-right corner.
 */
export function Presenter({ items, index, onExit }: Props) {
  const [showExit, setShowExit] = useState(false);
  const [cursorIdle, setCursorIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(idleTimer.current), []);

  const onMouseMove = (e: MouseEvent) => {
    setShowExit(e.clientX > window.innerWidth - CORNER.width && e.clientY < CORNER.height);
    setCursorIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setCursorIdle(true), 2000);
  };

  const current = items[index];
  const upcoming = items[index + 1];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Slideshow"
      onMouseMove={onMouseMove}
      onMouseLeave={() => setShowExit(false)}
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black ${cursorIdle && !showExit ? 'cursor-none' : ''}`}
    >
      <div className="w-[min(100vw,calc(100vh*16/9))]">
        {current && (
          <SlideFrame>
            <Slide item={current.slide} />
          </SlideFrame>
        )}
      </div>

      {/* Mount the next slide off-screen so its images are decoded before it's shown. */}
      {upcoming && (
        <div aria-hidden className="pointer-events-none fixed top-0 left-[-200vw] w-[min(100vw,calc(100vh*16/9))]">
          <SlideFrame>
            <Slide item={upcoming.slide} />
          </SlideFrame>
        </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className={`absolute top-[16px] right-[16px] flex items-center gap-[6px] rounded-[8px] bg-white/10 px-[12px] py-[8px] text-[14px] leading-[1.5] text-white backdrop-blur-sm transition-opacity duration-200 hover:bg-white/20 focus-visible:opacity-100 ${
          showExit ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <ArrowsIn size={16} />
        Exit fullscreen
      </button>
    </div>
  );
}
