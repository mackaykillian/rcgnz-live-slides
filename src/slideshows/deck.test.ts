import { describe, expect, it } from 'vitest';
import type { Session, Snapshot } from '../../shared/types';
import { buildSlides } from '../slides/buildSlides';
import { applyOverrides, resolveDeck, roomRuleset, type DeckDefinition } from './deck';

const session = (id: string, start: string, room: string): Session => ({
  id,
  title: id,
  start,
  end: null,
  tags: [],
  room,
  shrmCode: null,
  speakerIds: ['sp'],
});

const snapshot: Snapshot = {
  eventName: 'RCGNZ Summit 2026',
  syncedAt: '',
  source: 'mock',
  warnings: [],
  speakers: { sp: { id: 'sp', name: 'Speaker', jobTitle: null, company: null, headshots: {} } },
  sessions: [
    session('recLate', '2026-11-10T18:00:00Z', 'Grand Ballroom'),
    session('recEarly', '2026-11-09T18:00:00Z', 'Grand Ballroom'),
    session('recOther', '2026-11-09T17:00:00Z', 'Gallery I'),
  ],
};
const slides = buildSlides(snapshot);
const keys = (entries: { key: string }[]) => entries.map((e) => e.key);

describe('roomRuleset', () => {
  it('orders a room by start time, trios in template order, with Holding around each trio', () => {
    expect(keys(roomRuleset({ room: 'Grand Ballroom' })(slides))).toEqual([
      'static:holding@before:recEarly',
      'recEarly:upcoming',
      'recEarly:standard',
      'recEarly:shrm',
      'static:holding@before:recLate',
      'recLate:upcoming',
      'recLate:standard',
      'recLate:shrm',
      'static:holding@end',
    ]);
  });

  it('can turn separators off or restrict templates', () => {
    const entries = roomRuleset({
      room: 'Grand Ballroom',
      templates: ['standard'],
      separatorAt: { between: true },
    })(slides);
    expect(keys(entries)).toEqual(['recEarly:standard', 'static:holding@before:recLate', 'recLate:standard']);
  });

  it('returns nothing for a room without sessions', () => {
    expect(roomRuleset({ room: 'Nowhere' })(slides)).toEqual([]);
  });
});

describe('applyOverrides', () => {
  const base = roomRuleset({ room: 'Grand Ballroom', separator: null })(slides);

  it('inserts, removes and moves by key', () => {
    const { entries, warnings } = applyOverrides(base, [
      { op: 'insert', slideId: 'static:holding', key: 'break', after: 'recEarly:standard' },
      { op: 'remove', key: 'recLate:shrm' },
      { op: 'move', key: 'recLate:upcoming', before: 'recEarly:upcoming' },
    ]);
    expect(warnings).toEqual([]);
    expect(keys(entries)).toEqual([
      'recLate:upcoming',
      'recEarly:upcoming',
      'recEarly:standard',
      'break',
      'recEarly:shrm',
      'recLate:standard',
    ]);
  });

  it('reports overrides whose anchors are missing instead of failing', () => {
    const { entries, warnings } = applyOverrides(base, [{ op: 'remove', key: 'recGone:shrm' }]);
    expect(entries).toEqual(base);
    expect(warnings).toHaveLength(1);
  });
});

describe('resolveDeck', () => {
  it('maps entries to slides and drops ones that no longer exist', () => {
    const def: DeckDefinition = {
      id: 'gallery-i',
      name: 'Gallery I',
      build: roomRuleset({ room: 'Gallery I' }),
      overrides: [{ op: 'insert', slideId: 'recDeleted:standard' }],
    };
    const deck = resolveDeck(def, slides);
    expect(deck.items.map((i) => i.slide.id)).toEqual([
      'static:holding',
      'recOther:upcoming',
      'recOther:standard',
      'recOther:shrm',
      'static:holding',
    ]);
    expect(deck.warnings).toHaveLength(1);
  });
});
