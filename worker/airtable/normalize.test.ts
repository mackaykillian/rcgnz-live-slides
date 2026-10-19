import { describe, expect, it } from 'vitest';
import type { AirtableRecord } from './client';
import { AIRTABLE } from './fieldMap';
import { asText, asTextList, eventFormula, normalize, toRegistration } from './normalize';

const rec = (id: string, fields: Record<string, unknown>): AirtableRecord => ({ id, createdTime: '', fields });
const S = AIRTABLE.sessions.fields;
const P = AIRTABLE.speakers.fields;
const H = AIRTABLE.headshots.fields;

describe('field coercion', () => {
  it('handles text, selects, lookups and collaborators', () => {
    expect(asText('  Hi ')).toBe('Hi');
    expect(asText(['A', 'B'])).toBe('A, B');
    expect(asText({ name: 'Single select' })).toBe('Single select');
    expect(asText(null)).toBeNull();
    expect(asTextList('Breakout, Program DNA')).toEqual(['Breakout', 'Program DNA']);
  });

  it('escapes quotes in the event formula', () => {
    expect(eventFormula("Bob's Summit")).toBe(`FIND('Bob\\'s Summit', {${S.event}} & '')`);
  });
});

describe('normalize', () => {
  const out = normalize({
    sessions: [
      rec('recS1', { [S.title]: 'Make It Count', [S.start]: '2026-11-09T20:45:00.000Z', [S.speakers]: ['recP1', 'recGone'], [S.tags]: ['Breakout'] }),
    ],
    speakers: [
      rec('recP1', { [P.name]: 'Christi Gilhoi', [P.headshot]: ['recH1'] }),
      rec('recP2', { [P.name]: 'Other event speaker' }),
    ],
    headshots: [
      rec('recH1', {
        [H.transparent]: [{ id: 'attT', url: 'https://airtable/t.png' }],
        [H.sunset]: [{ id: 'attS', url: 'https://airtable/s.png' }],
      }),
    ],
  });

  it('joins sessions → speakers → headshots and serves images same-origin', () => {
    expect(out.sessions[0]!.speakerIds).toEqual(['recP1']);
    expect(out.speakers.recP1!.headshots).toEqual({
      transparent: { id: 'attT', url: '/api/images/attT' },
      sunset: { id: 'attS', url: '/api/images/attS' },
      aqua: undefined,
    });
    expect(out.imageSources).toEqual({ attT: 'https://airtable/t.png', attS: 'https://airtable/s.png' });
  });

  it('reads the room from the Location field', () => {
    expect(S.room).toBe('Location');
    const located = normalize({
      sessions: [rec('recL', { [S.title]: 'Keynote', [S.room!]: '  Grand Ballroom\n' }), rec('recN', { [S.title]: 'Break' })],
      speakers: [],
      headshots: [],
    });
    expect(located.sessions.map((x) => x.room)).toEqual(['Grand Ballroom', null]);
  });

  it('only keeps speakers used by this event', () => {
    expect(Object.keys(out.speakers)).toEqual(['recP1']);
  });
});

describe('toRegistration', () => {
  it('needs registration on and a positive capacity', () => {
    expect(toRegistration(true, 2, 20)).toEqual({ count: 2, capacity: 20 });
    expect(toRegistration(false, 2, 20)).toBeNull();
    expect(toRegistration(true, 2, undefined)).toBeNull();
    expect(toRegistration(true, 2, 0)).toBeNull();
  });

  it('treats a blank count as 0', () => {
    expect(toRegistration(true, undefined, 56)).toEqual({ count: 0, capacity: 56 });
  });
});
