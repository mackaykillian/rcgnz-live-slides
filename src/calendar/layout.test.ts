import { describe, expect, it } from 'vitest';
import type { Session } from '../../shared/types';
import {
  assignLanes,
  buildCalendarDay,
  formatHour,
  formatMinutes,
  isPast,
  minutesOfDay,
  NO_ROOM,
  PX_PER_MINUTE,
  registrationStatus,
  sessionTypeColor,
  sessionsWithoutLocation,
  scrollOffsetForTime,
  timeOptions,
  timeReference,
} from './layout';

// November in Denver is MST (UTC-7).
const at = (hhmm: string, date = '2026-11-10') => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8)), h! + 7, m!)).toISOString();
};
const session = (id: string, room: string | null, start: string, end: string, date?: string): Session => ({
  id,
  title: id,
  start: at(start, date),
  end: at(end, date),
  tags: [],
  room,
  shrmCode: null,
  speakerIds: [],
});

describe('minutesOfDay', () => {
  it('uses the event time zone', () => {
    expect(minutesOfDay(at('08:30'))).toBe(8 * 60 + 30);
  });
});

describe('assignLanes', () => {
  it('puts overlapping sessions side by side and leaves the rest full width', () => {
    const blocks = assignLanes([
      { session: session('a', 'X', '9:00', '10:00'), startMin: 540, endMin: 600 },
      { session: session('b', 'X', '9:30', '10:30'), startMin: 570, endMin: 630 },
      { session: session('c', 'X', '11:00', '11:30'), startMin: 660, endMin: 690 },
    ]);
    const byId = Object.fromEntries(blocks.map((b) => [b.session.id, [b.lane, b.lanes]]));
    expect(byId).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it('reuses a lane once it frees up', () => {
    const blocks = assignLanes([
      { session: session('a', 'X', '9:00', '12:00'), startMin: 540, endMin: 720 },
      { session: session('b', 'X', '9:00', '10:00'), startMin: 540, endMin: 600 },
      { session: session('c', 'X', '10:00', '11:00'), startMin: 600, endMin: 660 },
    ]);
    const byId = Object.fromEntries(blocks.map((b) => [b.session.id, [b.lane, b.lanes]]));
    expect(byId).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2] });
  });
});

describe('buildCalendarDay', () => {
  const sessions = [
    session('keynote', 'Grand Ballroom', '8:30', '8:45'),
    session('breakout', 'Gallery I', '13:00', '13:45'),
    session('lunch', null, '12:00', '13:00'),
    session('tour', 'Awardco HQ', '9:00', '10:00'),
    session('otherDay', 'Gallery I', '9:00', '10:00', '2026-11-11'),
  ];
  const day = buildCalendarDay(sessions, '2026-11-10');

  it('spans whole hours around the day’s sessions', () => {
    expect([day.startMin, day.endMin]).toEqual([8 * 60, 14 * 60]); // hidden-room sessions don't stretch the range
  });

  it('keeps the configured room order and hides "Awardco HQ" and "No room"', () => {
    const rooms = day.columns.map((c) => c.room);
    expect(rooms.slice(0, 4)).toEqual(['Empire West', 'Empire East', 'Empire Lounge', 'Grand Ballroom']);
    expect(rooms).not.toContain('Awardco HQ');
    expect(rooms).not.toContain(NO_ROOM);
    expect(day.columns.find((c) => c.room === 'Grand Ballroom')!.wide).toBe(true);
  });

  it('lists other unlisted rooms after the configured ones', () => {
    const extra = buildCalendarDay([session('pop-up', 'Rooftop', '9:00', '10:00')], '2026-11-10');
    expect(extra.columns.at(-1)!.room).toBe('Rooftop');
  });

  it('only includes the selected day', () => {
    const ids = day.columns.flatMap((c) => c.blocks.map((b) => b.session.id));
    expect(ids).not.toContain('otherDay');
  });

  it('formats hour labels', () => {
    expect([formatHour(480), formatHour(720), formatHour(780)]).toEqual(['8 AM', '12 PM', '1 PM']);
  });
});

describe('sessionTypeColor', () => {
  const withTags = (tags: string[]) => ({ ...session('x', 'Gallery I', '9:00', '10:00'), tags });

  it('colors Mainstage, Social and Breakout sessions (case-insensitive)', () => {
    expect(sessionTypeColor(withTags(['Lead From the Top', 'Mainstage']))).toBe('#256cfa');
    expect(sessionTypeColor(withTags(['social']))).toBe('#a8f39b');
    expect(sessionTypeColor(withTags(['Breakout']))).toBe('#fc835e');
  });

  it('leaves every other session without an indicator', () => {
    expect(sessionTypeColor(withTags(['Workshop', 'Meal']))).toBeNull();
    expect(sessionTypeColor(withTags([]))).toBeNull();
  });
});

describe('current time indicator', () => {
  it('uses the clock in live mode and the viewed day in manual mode', () => {
    const now = new Date(at('10:07'));
    expect(timeReference({ kind: 'live' }, now, '2026-11-11')).toEqual({ day: '2026-11-10', minutes: 607 });
    expect(timeReference({ kind: 'manual', minutes: 600 }, now, '2026-11-11')).toEqual({ day: '2026-11-11', minutes: 600 });
  });

  it('marks sessions done once they have ended, and whole earlier days as done', () => {
    const ref = { day: '2026-11-10', minutes: 600 };
    expect(isPast({ endMin: 600 }, '2026-11-10', ref)).toBe(true);
    expect(isPast({ endMin: 615 }, '2026-11-10', ref)).toBe(false); // still in progress
    expect(isPast({ endMin: 1200 }, '2026-11-09', ref)).toBe(true);
    expect(isPast({ endMin: 480 }, '2026-11-11', ref)).toBe(false);
  });

  it('offers 15-minute steps and formats them', () => {
    expect(timeOptions(480, 540).map(formatMinutes)).toEqual(['8:00 AM', '8:15 AM', '8:30 AM', '8:45 AM', '9:00 AM']);
    expect(formatMinutes(12 * 60 + 5)).toBe('12:05 PM');
  });

  it('puts the time 25% down the window, clamped to the day', () => {
    const total = 10 * 60 * PX_PER_MINUTE; // 8 AM – 6 PM
    const win = 600;
    expect(scrollOffsetForTime(12 * 60, 8 * 60, total, win)).toBeCloseTo(4 * 60 * PX_PER_MINUTE - 150);
    expect(scrollOffsetForTime(8 * 60, 8 * 60, total, win)).toBe(0); // can't go above the day start
    expect(scrollOffsetForTime(18 * 60, 8 * 60, total, win)).toBe(total - win); // or past the end
    expect(scrollOffsetForTime(null, 8 * 60, total, win)).toBe(0);
  });
});

describe('sessionsWithoutLocation', () => {
  it('lists sessions with no location, earliest first', () => {
    const list = sessionsWithoutLocation([
      session('late', null, '15:00', '15:15'),
      session('placed', 'Gallery I', '9:00', '10:00'),
      session('early', null, '10:15', '10:30'),
    ]);
    expect(list.map((s) => s.id)).toEqual(['early', 'late']);
  });

  it('hides Montage Entrance from the timeline', () => {
    const day = buildCalendarDay([session('shuttle', 'Montage Entrance', '15:45', '16:00')], '2026-11-10');
    expect(day.columns.map((c) => c.room)).not.toContain('Montage Entrance');
  });
});

describe('registrationStatus', () => {
  it('is Open with 25% or more of seats left, Low below that, Full when taken', () => {
    expect(registrationStatus({ count: 2, capacity: 20 })).toBe('open');
    expect(registrationStatus({ count: 15, capacity: 20 })).toBe('open'); // exactly 25% left
    expect(registrationStatus({ count: 17, capacity: 20 })).toBe('low');
    expect(registrationStatus({ count: 20, capacity: 20 })).toBe('full');
    expect(registrationStatus({ count: 23, capacity: 20 })).toBe('full'); // oversubscribed
  });
});
