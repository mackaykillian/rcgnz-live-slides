import type { Session } from '../../shared/types';
import { EVENT_TIME_ZONE } from '../config';
import { eventDayKey } from '../lib/time';

/** Rooms in column order. Any other room with sessions that day follows, alphabetically. */
export const CALENDAR_ROOMS = [
  'Empire West',
  'Empire East',
  'Empire Lounge',
  'Grand Ballroom',
  'Grand Promenade',
  'Gallery I',
  'Gallery II',
  'Fitness Studio',
  'Vista Lounge',
];

/** Room label background colors on the timeline; unlisted rooms keep the default white 10%. */
export const ROOM_LABEL_COLORS: Record<string, string> = {
  'Empire West': 'rgb(252 131 94 / 0.15)', // #FC835E 15%
  'Empire East': 'rgb(252 131 94 / 0.15)',
  'Empire Lounge': 'rgb(252 131 94 / 0.15)',
  'Grand Ballroom': 'rgb(37 108 250 / 0.15)', // #256CFA 15%
  'Grand Promenade': 'rgb(37 108 250 / 0.15)',
  'Gallery I': 'rgb(168 243 155 / 0.25)', // #A8F39B 25%
  'Gallery II': 'rgb(168 243 155 / 0.25)',
};

/** The event's mainstage — its column is twice as wide as the others. */
export const MAINSTAGE_ROOM = 'Grand Ballroom';

/** Column label for sessions without a room in Airtable. */
export const NO_ROOM = 'No room';

/** Rooms not shown on the timeline. Their sessions keep their room in the data; they just aren't displayed. */
export const HIDDEN_CALENDAR_ROOMS = ['Montage Entrance', NO_ROOM];

/** Rooms shown as the last columns, and only on days they have sessions (e.g. the Awardco HQ tour day). */
export const TRAILING_ROOMS = ['Awardco HQ'];

/** Sessions with no location in Airtable, in start order — flagged above the timeline. */
export function sessionsWithoutLocation(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => !s.room)
    .sort((a, b) => (a.start ?? '\uffff').localeCompare(b.start ?? '\uffff') || a.title.localeCompare(b.title));
}

/** Whether a session appears on the timeline. */
export const isShownInCalendar = (session: Session) => !HIDDEN_CALENDAR_ROOMS.includes(session.room ?? NO_ROOM);

/** Session types (Airtable tags) that get a colored indicator; others have none. */
export const SESSION_TYPE_COLORS: Record<string, string> = {
  Mainstage: '#256cfa',
  Social: '#a8f39b',
  Breakout: '#fc835e',
};

/** Indicator color for a session's type, or null when it isn't one of the highlighted types. */
export function sessionTypeColor(session: Session): string | null {
  const types = Object.keys(SESSION_TYPE_COLORS);
  const match = session.tags.map((t) => t.trim().toLowerCase()).find((t) => types.some((type) => type.toLowerCase() === t));
  return match ? SESSION_TYPE_COLORS[types.find((type) => type.toLowerCase() === match)!]! : null;
}

// ---- Registration availability ---------------------------------------------

export type RegistrationStatus = 'open' | 'low' | 'full';

/** Tag colors from Figma "Session Registration Availability Tag". */
export const REGISTRATION_TAG = {
  open: { label: 'Open', background: 'rgb(168 243 155 / 0.25)' },
  low: { label: 'Low', background: 'rgb(255 234 100 / 0.25)' },
  full: { label: 'Full', background: 'rgb(248 106 106 / 0.25)' },
} as const;

/** Full when every seat is taken; Low when under 25% of seats remain; otherwise Open. */
export function registrationStatus({ count, capacity }: { count: number; capacity: number }): RegistrationStatus {
  if (count >= capacity) return 'full';
  return (capacity - count) / capacity < 0.25 ? 'low' : 'open';
}

/** Vertical scale: pixels per minute (160px per hour). */
export const PX_PER_MINUTE = 160 / 60;

export interface CalendarBlock {
  session: Session;
  /** Minutes since midnight (event time zone). */
  startMin: number;
  endMin: number;
  /** Side-by-side placement when sessions in a room overlap. */
  lane: number;
  lanes: number;
}

export interface CalendarColumn {
  room: string;
  wide: boolean;
  blocks: CalendarBlock[];
}

export interface CalendarDay {
  /** Whole hours (minutes since midnight) bounding the day's sessions. */
  startMin: number;
  endMin: number;
  columns: CalendarColumn[];
}

const timeParts = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIME_ZONE,
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/** Minutes since midnight in the event's time zone. */
export function minutesOfDay(iso: string): number {
  const parts = Object.fromEntries(timeParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/**
 * Assign overlapping sessions to lanes (Google Calendar style): each cluster of
 * transitively overlapping sessions shares its width between the lanes it needs.
 */
export function assignLanes(blocks: Omit<CalendarBlock, 'lane' | 'lanes'>[]): CalendarBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: CalendarBlock[] = [];
  let cluster: CalendarBlock[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    for (const b of cluster) b.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const b of sorted) {
    if (cluster.length && b.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.startMin);
    if (lane < 0) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = b.endMin;
    cluster.push({ ...b, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  flush();
  return out;
}

/** Columns + time range for one event day (`YYYY-MM-DD`). */
export function buildCalendarDay(sessions: Session[], day: string): CalendarDay {
  const byRoom = new Map<string, Omit<CalendarBlock, 'lane' | 'lanes'>[]>();
  let first = Infinity;
  let last = -Infinity;

  for (const session of sessions) {
    if (!session.start || eventDayKey(session.start) !== day || !isShownInCalendar(session)) continue;
    const startMin = minutesOfDay(session.start);
    // Missing/backwards end times still get a visible 15-minute block.
    let endMin = session.end ? minutesOfDay(session.end) : startMin + 15;
    if (session.end && eventDayKey(session.end) !== day) endMin = 24 * 60; // runs past midnight
    if (endMin <= startMin) endMin = startMin + 15;

    const room = session.room ?? NO_ROOM;
    byRoom.set(room, [...(byRoom.get(room) ?? []), { session, startMin, endMin }]);
    first = Math.min(first, startMin);
    last = Math.max(last, endMin);
  }

  const extras = [...byRoom.keys()]
    .filter((r) => !CALENDAR_ROOMS.includes(r) && !TRAILING_ROOMS.includes(r) && r !== NO_ROOM)
    .sort();
  const trailing = TRAILING_ROOMS.filter((r) => byRoom.has(r));
  const order = [...CALENDAR_ROOMS, ...extras, ...trailing, ...(byRoom.has(NO_ROOM) ? [NO_ROOM] : [])];

  return {
    startMin: Number.isFinite(first) ? Math.floor(first / 60) * 60 : 8 * 60,
    endMin: Number.isFinite(last) ? Math.ceil(last / 60) * 60 : 18 * 60,
    columns: order.map((room) => ({
      room,
      wide: room === MAINSTAGE_ROOM,
      blocks: assignLanes(byRoom.get(room) ?? []),
    })),
  };
}

/** "8 AM" */
export function formatHour(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
}

// ---- Current time indicator -------------------------------------------------

/** Live follows the clock; manual pins the time (15-minute steps) on the day being viewed. */
export type TimeMode = { kind: 'live' } | { kind: 'manual'; minutes: number };

export interface TimeReference {
  day: string;
  minutes: number;
}

export function timeReference(mode: TimeMode, now: Date, viewedDay: string): TimeReference {
  return mode.kind === 'live'
    ? { day: eventDayKey(now.toISOString()), minutes: minutesOfDay(now.toISOString()) }
    : { day: viewedDay, minutes: mode.minutes };
}

/** A session is done once its end time has passed (in-progress sessions are not). */
export function isPast(block: Pick<CalendarBlock, 'endMin'>, day: string, ref: TimeReference): boolean {
  if (day !== ref.day) return day < ref.day;
  return block.endMin <= ref.minutes;
}

/** 15-minute choices for the manual time picker. */
export function timeOptions(startMin: number, endMin: number, step = 15): number[] {
  const out: number[] = [];
  for (let m = startMin; m <= endMin; m += step) out.push(m);
  return out;
}

/** "10:00 AM" from minutes since midnight. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Scroll position (px) that puts `minutes` a `fraction` of the way down a
 * viewport of `viewHeight`, without scrolling past the start or end of the day.
 */
export function scrollOffsetForTime(
  minutes: number | null,
  dayStartMin: number,
  totalHeight: number,
  viewHeight: number,
  fraction = 0.25,
): number {
  if (minutes == null) return 0;
  const target = (minutes - dayStartMin) * PX_PER_MINUTE - viewHeight * fraction;
  return Math.max(0, Math.min(target, Math.max(0, totalHeight - viewHeight)));
}
