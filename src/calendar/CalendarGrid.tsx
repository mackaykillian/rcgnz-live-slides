import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { Session, Speaker } from '../../shared/types';
import { formatTimeRange } from '../lib/time';
import {
  formatHour,
  isPast,
  PX_PER_MINUTE,
  scrollOffsetForTime,
  REGISTRATION_TAG,
  registrationStatus,
  ROOM_LABEL_COLORS,
  sessionTypeColor,
  type CalendarBlock,
  type CalendarDay,
  type TimeReference,
} from './layout';

const HEADER_HEIGHT = 40; // room label (32) + gap (8)
const GUTTER_WIDTH = 64;
const COLUMN_GAP = 12;
/** Current-time line color (Figma: Lime Green). */
const NOW_COLOR = '#a8f39b';

function Avatars({ speakers }: { speakers: Speaker[] }) {
  const shown = speakers.slice(0, 5);
  const extra = speakers.length - shown.length;
  return (
    <div className="flex items-center -space-x-[6px]">
      {shown.map((sp) => {
        const img = sp.headshots.sunset ?? sp.headshots.aqua ?? sp.headshots.transparent;
        return img ? (
          <img
            key={sp.id}
            src={img.url}
            alt={sp.name}
            data-tooltip={sp.name}
            loading="lazy"
            className="size-[24px] rounded-full bg-[#1b2635] object-cover ring-2 ring-ink"
          />
        ) : (
          <span
            key={sp.id}
            data-tooltip={sp.name}
            className="flex size-[24px] items-center justify-center rounded-full bg-[#1b2635] text-[10px] text-white ring-2 ring-ink"
          >
            {sp.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join('')}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="flex size-[24px] items-center justify-center rounded-full bg-[#1b2635] text-[10px] text-white ring-2 ring-ink">
          +{extra}
        </span>
      )}
    </div>
  );
}

function RegistrationTag({ count, capacity, className = '' }: { count: number; capacity: number; className?: string }) {
  const status = REGISTRATION_TAG[registrationStatus({ count, capacity })];
  return (
    <span
      data-tooltip={`${status.label}: ${count} of ${capacity} seats registered`}
      className={`flex shrink-0 items-center gap-[6px] rounded-[2px] px-[6px] py-[2px] text-[10px] leading-[1.5] font-normal whitespace-nowrap ${className}`}
      style={{ background: status.background }}
    >
      <span className="text-white">{status.label}</span>
      <span className="text-white/50">
        {count}/{capacity}
      </span>
    </span>
  );
}

/** Below this block height there's no room for the tag in the corner, so it sits inline. */
const CORNER_TAG_MIN_HEIGHT = 52;

function SessionBlock(props: { block: CalendarBlock; dayStart: number; speakers: Speaker[]; past: boolean }) {
  const { block, dayStart, speakers, past } = props;
  const { session, startMin, endMin, lane, lanes } = block;
  const time = formatTimeRange(session.start, session.end);
  // Under 30 min there's only room for one line; 30 min fits title, time and avatars.
  const compact = endMin - startMin < 30;
  // Mainstage / Social / Breakout get a colored line beside the content.
  const typeColor = sessionTypeColor(session);
  const indicator = typeColor ? 'border-l-2 pl-[8px]' : '';
  const height = Math.max((endMin - startMin) * PX_PER_MINUTE - 2, 18);
  const registration = session.registration;
  const inlineTag = registration && height < CORNER_TAG_MIN_HEIGHT;

  return (
    <div
      data-tooltip={`${session.title}\n${time}${speakers.length ? `\n${speakers.map((s) => s.name).join(', ')}` : ''}`}
      className={`absolute overflow-hidden rounded-[4px] border border-white/15 bg-ink px-[12px] py-[6px] text-white transition-opacity ${past ? 'opacity-50' : ''}`}
      style={{
        top: (startMin - dayStart) * PX_PER_MINUTE,
        height,
        left: `calc(${(lane / lanes) * 100}% + ${lane ? 1 : 0}px)`,
        width: `calc(${100 / lanes}% - ${lanes > 1 ? 1 : 0}px)`,
      }}
    >
      {compact ? (
        <p
          className={`flex items-baseline gap-[8px] text-[14px] leading-[20px] ${indicator}`}
          style={typeColor ? { borderColor: typeColor } : undefined}
        >
          <span className="min-w-0 truncate" data-tooltip={session.title}>
            {session.title}
          </span>
          <span className="shrink-0 text-[12px] text-white/60">{time}</span>
          {inlineTag && <RegistrationTag {...registration} className="ml-auto self-center" />}
        </p>
      ) : (
        <div className={`flex flex-col gap-[2px] ${indicator}`} style={typeColor ? { borderColor: typeColor } : undefined}>
          <p className="truncate text-[14px] leading-[20px]" data-tooltip={session.title}>
            {session.title}
          </p>
          <p className="truncate text-[12px] leading-[16px] text-white/60">{time}</p>
          {speakers.length > 0 && (
            <div className="pt-[4px]">
              <Avatars speakers={speakers} />
            </div>
          )}
        </div>
      )}
      {registration && !inlineTag && <RegistrationTag {...registration} className="absolute right-[5px] bottom-[5px]" />}
    </div>
  );
}

interface Props {
  day: string;
  calendar: CalendarDay;
  speakersFor: (session: Session) => Speaker[];
  /** Live or manual time. Sessions that ended before it are dimmed; the line shows on its day. */
  reference: TimeReference;
  /** Re-centers on the time line (about 25% down) whenever this value changes. */
  scrollKey?: string;
}

/** Room columns with time-proportional session blocks. */
export function CalendarGrid({ day, calendar, speakersFor, reference, scrollKey }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const height = (calendar.endMin - calendar.startMin) * PX_PER_MINUTE;
  const hours: number[] = [];
  for (let m = calendar.startMin; m <= calendar.endMin; m += 60) hours.push(m);

  const lineMin = reference.day === day ? reference.minutes : null;
  const showLine = lineMin != null && lineMin >= calendar.startMin && lineMin <= calendar.endMin;

  // Bring the line about a quarter of the way down when `scrollKey`
  // changes (day switch, new manual time) — not every minute, so it never
  // fights someone who is scrolling around.
  const anchorRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    anchorRef.current = showLine ? lineMin : null;
  });
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = anchorRef.current;
    if (!el || anchor == null) return;
    el.scrollTop = scrollOffsetForTime(anchor, calendar.startMin, height, el.clientHeight - HEADER_HEIGHT);
  }, [scrollKey, calendar.startMin, height]);

  const columnStyle = (wide: boolean): CSSProperties => ({
    flex: wide ? '2 0 400px' : '1 0 200px',
    marginLeft: COLUMN_GAP,
  });

  const header = (
    <div className="sticky top-0 z-20 flex bg-ink" style={{ height: HEADER_HEIGHT }}>
      <div className="sticky left-0 z-30 shrink-0 bg-ink" style={{ width: GUTTER_WIDTH }} />
      {calendar.columns.map((col) => (
        <div key={col.room} className="pb-[8px]" style={columnStyle(col.wide)}>
          <div
            className="flex h-[32px] items-center justify-center truncate rounded-[4px] bg-white/10 px-[8px] text-[14px] text-white"
            style={ROOM_LABEL_COLORS[col.room] ? { background: ROOM_LABEL_COLORS[col.room] } : undefined}
          >
            {col.room}
          </div>
        </div>
      ))}
    </div>
  );

  const body = (
    <div className="relative flex">
      {/* Painted first so it shows through the translucent columns but stays behind sessions (as in Figma). */}
      {showLine && (
        <div
          aria-label="Current time"
          className="pointer-events-none absolute right-0 h-px"
          style={{ top: (lineMin - calendar.startMin) * PX_PER_MINUTE, left: GUTTER_WIDTH, background: NOW_COLOR }}
        />
      )}
      {/* Time gutter — sticks to the left while scrolling sideways. */}
      <div className="sticky left-0 z-10 shrink-0 bg-ink" style={{ width: GUTTER_WIDTH }}>
        <div className="relative" style={{ height }}>
          {hours.map((m) => (
            <span
              key={m}
              // The first label sits below the top edge instead of half under the room headers.
              className={`absolute left-0 text-[12px] leading-none whitespace-nowrap text-white/70 ${m === calendar.startMin ? '' : '-translate-y-1/2'}`}
              style={{ top: (m - calendar.startMin) * PX_PER_MINUTE }}
            >
              {formatHour(m)}
            </span>
          ))}
        </div>
      </div>

      {calendar.columns.map((col) => (
        <div
          key={col.room}
          className="relative bg-white/5"
          style={{
            ...columnStyle(col.wide),
            height,
            // Faint hour lines.
            backgroundImage: 'linear-gradient(to bottom, rgb(255 255 255 / 0.05) 1px, transparent 1px)',
            backgroundSize: `100% ${60 * PX_PER_MINUTE}px`,
          }}
        >
          {col.blocks.map((block) => (
            <SessionBlock
              key={block.session.id}
              block={block}
              dayStart={calendar.startMin}
              speakers={speakersFor(block.session)}
              past={isPast(block, day, reference)}
            />
          ))}
        </div>
      ))}

    </div>
  );

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-contain [color-scheme:dark]">
      <div className="w-max min-w-full">
        {header}
        {body}
      </div>
    </div>
  );
}
