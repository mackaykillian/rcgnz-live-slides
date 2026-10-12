import { EVENT_TIME_ZONE } from '../config';

const parts = (iso: string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: EVENT_TIME_ZONE, ...options })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );

/** "Nov 9" */
export function formatDay(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: EVENT_TIME_ZONE, month: 'short', day: 'numeric' }).format(
    new Date(iso),
  );
}

/** "10:00 AM" */
export function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: EVENT_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
}

/** "10:00 AM - 10:45 AM" */
export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return '';
  return end ? `${formatTime(start)} - ${formatTime(end)}` : formatTime(start);
}

/** "2026-11-09" — the event-local calendar day, for the Day filter. */
export function eventDayKey(iso: string): string {
  const p = parts(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "Nov 9" from a "2026-11-09" day key. */
export function formatDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}

/** "11092026_1345" — event-local date/time stamp used in export file names. */
export function fileStamp(iso: string): string {
  const p = parts(iso, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.month}${p.day}${p.year}_${p.hour}${p.minute}`;
}

/** "12:52pm" in the viewer's own time zone — for "last synced". */
export function formatSyncedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso))
    .replace(/\s?(AM|PM)$/, (_, ampm: string) => ampm.toLowerCase());
}
