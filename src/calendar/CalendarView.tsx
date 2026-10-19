import { useEffect, useMemo, useState } from 'react';
import { ArrowsIn, ArrowsOut, CaretUpDown, Play, Warning } from '@phosphor-icons/react';
import type { Session, Speaker, Snapshot } from '../../shared/types';
import { EVENT_DAYS } from '../config';
import { eventDayKey, formatDay, formatTime } from '../lib/time';
import { CalendarGrid } from './CalendarGrid';
import {
  buildCalendarDay,
  formatMinutes,
  isShownInCalendar,
  sessionsWithoutLocation,
  timeOptions,
  timeReference,
  type TimeMode,
} from './layout';
import { useNow } from './useNow';

const dayTabLabel = (day: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(`${day}T12:00:00Z`),
  );

const focusRing = 'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none';

interface Props {
  snapshot: Snapshot;
  day: string | null;
  onDay: (day: string) => void;
}

/** Google Calendar–style day view: one column per room, blocks sized by session length. */
export function CalendarView({ snapshot, day, onDay }: Props) {
  const now = useNow();
  const todayKey = eventDayKey(now.toISOString());
  const selected = day && EVENT_DAYS.includes(day) ? day : EVENT_DAYS.includes(todayKey) ? todayKey : EVENT_DAYS[0]!;

  const [timeMode, setTimeMode] = useState<TimeMode>({ kind: 'live' });
  const [fullscreen, setFullscreen] = useState(false);
  const live = timeMode.kind === 'live';
  const reference = timeReference(timeMode, now, selected);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of snapshot.sessions) {
      if (s.start && isShownInCalendar(s)) c[eventDayKey(s.start)] = (c[eventDayKey(s.start)] ?? 0) + 1;
    }
    return c;
  }, [snapshot]);

  const calendar = useMemo(() => buildCalendarDay(snapshot.sessions, selected), [snapshot, selected]);
  const speakersFor = (session: Session) =>
    session.speakerIds.map((id) => snapshot.speakers[id]).filter((s): s is Speaker => !!s);
  const hasSessions = calendar.columns.some((c) => c.blocks.length);
  // These are hidden from the timeline, so call them out until they get a location.
  const unlocated = useMemo(() => sessionsWithoutLocation(snapshot.sessions), [snapshot]);

  // Fullscreen is this same view expanded over the whole screen (sidebar hidden),
  // so the day, scroll position and time mode carry over in both directions.
  // Leaving browser fullscreen (Esc, or the browser's own UI) returns to normal.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Browsers without the Fullscreen API still get the expanded view; Esc closes it.
  useEffect(() => {
    if (!fullscreen || document.fullscreenElement) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const toggleFullscreen = () => {
    if (fullscreen) {
      if (document.fullscreenElement) void document.exitFullscreen();
      else setFullscreen(false);
      return;
    }
    setFullscreen(true);
    // Must run inside the click handler — browsers only allow fullscreen from a user gesture.
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div
      className={`flex flex-col gap-[16px] ${fullscreen ? 'fixed inset-0 z-50 bg-ink p-[24px]' : 'h-full'}`}
      role={fullscreen ? 'dialog' : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? 'Agenda Timeline (fullscreen)' : undefined}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-[16px]">
        <div role="tablist" aria-label="Event day" className="flex gap-[4px]">
          {EVENT_DAYS.map((d) => {
            const active = d === selected;
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onDay(d)}
                className={`rounded-[6px] px-[12px] py-[6px] text-[14px] leading-[20px] ${focusRing} ${
                  active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                {dayTabLabel(d)}
                <span className="ml-[6px] text-[12px] text-white/40">{counts[d] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-[16px]">
          {/* Time: pick a 15-minute slot (manual) or follow the clock (Live). */}
          <div className="flex items-center">
            <label
              className={`relative flex items-center gap-[6px] rounded-l-[8px] border-r border-white/10 bg-white/10 px-[12px] py-[8px] text-[14px] leading-[1.5] focus-within:ring-2 focus-within:ring-accent ${
                live ? 'text-[#858c93]' : 'text-white'
              }`}
            >
              {formatMinutes(live ? reference.minutes : timeMode.minutes)}
              <CaretUpDown size={16} />
              <select
                aria-label="Show the agenda at a specific time"
                value={live ? '' : String(timeMode.minutes)}
                onChange={(e) => e.target.value && setTimeMode({ kind: 'manual', minutes: Number(e.target.value) })}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="" disabled>
                  Live
                </option>
                {timeOptions(calendar.startMin, calendar.endMin).map((m) => (
                  <option key={m} value={m}>
                    {formatMinutes(m)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setTimeMode({ kind: 'live' })}
              aria-pressed={live}
              className={`flex items-center gap-[6px] rounded-r-[8px] px-[12px] py-[8px] text-[14px] leading-[1.5] text-white ${focusRing} ${
                live ? 'bg-accent' : 'bg-white/10 hover:bg-white/15'
              }`}
            >
              <Play size={16} weight={live ? 'fill' : 'regular'} />
              Live
            </button>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-pressed={fullscreen}
            className={`flex items-center gap-[6px] rounded-[8px] bg-white/10 px-[12px] py-[8px] text-[14px] leading-[1.5] text-white hover:bg-white/15 ${focusRing}`}
          >
            {fullscreen ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {unlocated.length > 0 && (
        <div
          role="status"
          className="flex shrink-0 items-start gap-[8px] rounded-[8px] border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-[12px] py-[8px] text-[12px] leading-[1.5] text-[#fde68a]"
        >
          <Warning size={16} weight="fill" className="mt-[1px] shrink-0 text-[#fbbf24]" />
          <p className="min-w-0 [overflow-wrap:anywhere]">
            <span className="text-white">
              {unlocated.length} session{unlocated.length === 1 ? ' has' : 's have'} no location in Airtable and{' '}
              {unlocated.length === 1 ? 'is' : 'are'} hidden:
            </span>{' '}
            {unlocated.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ', '}
                {s.title}
                {s.start && (
                  <span className="text-[#fde68a]/70">
                    {' '}
                    ({formatDay(s.start)}, {formatTime(s.start)})
                  </span>
                )}
              </span>
            ))}
          </p>
        </div>
      )}

      {!hasSessions ? (
        <p className="flex flex-1 items-center justify-center text-[14px] text-white/60">No sessions on this day.</p>
      ) : (
        <CalendarGrid
          day={selected}
          calendar={calendar}
          speakersFor={speakersFor}
          reference={reference}
          scrollKey={`${selected}|${live ? 'live' : timeMode.minutes}`}
        />
      )}

    </div>
  );
}
