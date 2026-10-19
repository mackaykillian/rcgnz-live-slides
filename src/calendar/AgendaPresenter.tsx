import { useState, type MouseEvent } from 'react';
import { ArrowsIn } from '@phosphor-icons/react';
import type { Session, Speaker } from '../../shared/types';
import rcgnzLogo from '../assets/slides/rcgnz-logo.svg';
import { useElementWidth } from '../lib/useElementWidth';
import { CalendarGrid, HEADER_HEIGHT } from './CalendarGrid';
import { formatMinutes, type CalendarDay, type TimeReference } from './layout';

/** Logical size of the full-screen agenda; scaled to fit the screen at 16:9. */
const STAGE = { width: 1600, height: 900, padding: 32, topBar: 40, gap: 16 };
const WINDOW_HEIGHT = STAGE.height - STAGE.padding * 2 - STAGE.topBar - STAGE.gap - HEADER_HEIGHT;

/** How close (px) to the top-right corner the cursor must be to reveal "Exit fullscreen". */
const CORNER = { width: 280, height: 140 };

interface Props {
  day: string;
  dayLabel: string;
  calendar: CalendarDay;
  speakersFor: (session: Session) => Speaker[];
  reference: TimeReference;
  live: boolean;
  /** Time the view is positioned on (snapped to 15 minutes in live mode). */
  anchorMin: number | null;
  onExit: () => void;
}

/** Full-screen agenda for displays: no scrolling, the current time held ~25% from the top. */
export function AgendaPresenter({ day, dayLabel, calendar, speakersFor, reference, live, anchorMin, onExit }: Props) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>();
  const [showExit, setShowExit] = useState(false);
  const onMouseMove = (e: MouseEvent) =>
    setShowExit(e.clientX > window.innerWidth - CORNER.width && e.clientY < CORNER.height);

  const onThisDay = reference.day === day;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agenda"
      onMouseMove={onMouseMove}
      onMouseLeave={() => setShowExit(false)}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black"
    >
      <div ref={frameRef} className="relative aspect-video w-[min(100vw,calc(100vh*16/9))] overflow-hidden bg-ink">
        {width > 0 && (
          <div
            className="absolute top-0 left-0 flex origin-top-left flex-col"
            style={{
              width: STAGE.width,
              height: STAGE.height,
              padding: STAGE.padding,
              gap: STAGE.gap,
              transform: `scale(${width / STAGE.width})`,
            }}
          >
            <div className="flex shrink-0 items-center justify-between text-white" style={{ height: STAGE.topBar }}>
              <div className="flex items-baseline gap-[12px]">
                <p className="text-[24px] leading-none">{dayLabel}</p>
                {onThisDay && (
                  <p className="flex items-center gap-[6px] text-[16px] leading-none text-white/70">
                    {live && <span className="size-[8px] rounded-full bg-[#a8f39b]" aria-hidden />}
                    {formatMinutes(reference.minutes)}
                  </p>
                )}
              </div>
              <img src={rcgnzLogo} alt="RCGNZ" className="h-[24px] w-auto" />
            </div>
            <CalendarGrid
              day={day}
              calendar={calendar}
              speakersFor={speakersFor}
              reference={reference}
              mode={{ kind: 'fixed', windowHeight: WINDOW_HEIGHT, anchorMin }}
            />
          </div>
        )}
      </div>

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
