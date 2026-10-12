import { describe, expect, it } from 'vitest';
import type { Session, Snapshot } from '../../shared/types';
import { buildSlides } from '../slides/buildSlides';
import { DEFAULT_SORT, filterAndSortSlides, type SlideQuery } from './filterSlides';
import { slideFileName, pascalCase } from './filename';

const session = (id: string, title: string, start: string | null, extra: Partial<Session> = {}): Session => ({
  id,
  title,
  start,
  end: null,
  tags: [],
  room: null,
  shrmCode: null,
  speakerIds: [],
  ...extra,
});

const snapshot: Snapshot = {
  eventName: 'RCGNZ Summit 2026',
  syncedAt: '2026-10-11T00:00:00Z',
  source: 'mock',
  warnings: [],
  speakers: {
    sp1: { id: 'sp1', name: 'Christi Gilhoi', jobTitle: null, company: 'Awardco', headshots: {} },
    sp2: { id: 'sp2', name: 'Steve Sonnenberg', jobTitle: 'CEO', company: 'Awardco', headshots: {} },
  },
  sessions: [
    // 1:45pm MST on Nov 9 = 20:45Z
    session('b', 'Make It Count', '2026-11-09T20:45:00Z', { speakerIds: ['sp1'], tags: ['Breakout'], shrmCode: '26-NR9NK' }),
    session('a', 'Opening Keynote', '2026-11-09T16:00:00Z', { speakerIds: ['sp2'] }),
    session('c', 'Closing Party', '2026-11-11T03:00:00Z', { speakerIds: ['sp2'] }), // Nov 10, 8pm local
    session('d', 'Lunch', '2026-11-09T19:00:00Z'), // no speakers → no slides
  ],
};

const query = (q: Partial<SlideQuery> = {}): SlideQuery => ({
  search: '',
  template: null,
  day: null,
  room: null,
  sort: DEFAULT_SORT,
  ...q,
});

const slides = buildSlides(snapshot);

describe('buildSlides', () => {
  it('makes the speaker templates for sessions with speakers, plus one holding slide', () => {
    expect(slides).toHaveLength(3 * 3 + 1);
    expect(slides.filter((s) => s.template === 'holding')).toHaveLength(1);
  });

  it('skips sessions without speakers', () => {
    expect(slides.some((s) => s.session?.id === 'd')).toBe(false);
  });

  it('flags SHRM slides without a code', () => {
    const shrm = slides.find((s) => s.id === 'a:shrm')!;
    expect(shrm.issues).toContain('No SHRM code in Airtable');
  });
});

describe('filterAndSortSlides', () => {
  it('sorts by start time with each session grouped and the holding slide last', () => {
    const ids = filterAndSortSlides(slides, query()).map((s) => s.id);
    expect(ids.slice(0, 3)).toEqual(['a:upcoming', 'a:standard', 'a:shrm']);
    expect(ids.at(-1)).toBe('static:holding');
  });

  it('keeps undated slides last when sorting descending', () => {
    const ids = filterAndSortSlides(slides, query({ sort: { key: 'date', dir: 'desc' } })).map((s) => s.id);
    expect(ids[0]).toBe('c:upcoming');
    expect(ids.at(-1)).toBe('static:holding');
  });

  it('filters by template, event-local day and search terms', () => {
    expect(filterAndSortSlides(slides, query({ template: 'standard' }))).toHaveLength(3);
    // 03:00Z on Nov 11 is still Nov 10 in Denver.
    expect(filterAndSortSlides(slides, query({ day: '2026-11-10' })).map((s) => s.session?.id)).toEqual(['c', 'c', 'c']);
    expect(filterAndSortSlides(slides, query({ search: 'gilhoi breakout' })).every((s) => s.session?.id === 'b')).toBe(true);
    expect(filterAndSortSlides(slides, query({ search: 'nobody' }))).toHaveLength(0);
  });
});

describe('slideFileName', () => {
  it('uses the event-local start stamp, PascalCase title and template', () => {
    const item = slides.find((s) => s.id === 'b:standard')!;
    expect(slideFileName(item)).toBe('11092026_1345_MakeItCount_Standard.png');
  });

  it('strips punctuation and accents', () => {
    expect(pascalCase('Ask the Experts: COE + Product & Strategy — café')).toBe('AskTheExpertsCOEProductAndStrategyCafe');
  });
});
