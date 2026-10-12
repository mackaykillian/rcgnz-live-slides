import { templateOrder, type SlideItem, type TemplateId } from '../slides/templates';
import { eventDayKey } from './time';

export type SortKey = 'name' | 'date' | 'slide';
export type SortDir = 'asc' | 'desc';

export interface SlideQuery {
  search: string;
  template: TemplateId | null;
  day: string | null;
  room: string | null;
  sort: { key: SortKey; dir: SortDir };
}

export const DEFAULT_SORT: SlideQuery['sort'] = { key: 'date', dir: 'asc' };

function searchText(item: SlideItem): string {
  const s = item.session;
  return [
    item.title,
    ...item.speakers.flatMap((sp) => [sp.name, sp.company ?? '']),
    ...(s?.tags ?? []),
    s?.shrmCode ?? '',
    s?.room ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

const startMs = (item: SlideItem) => (item.session?.start ? Date.parse(item.session.start) : Infinity);

const compareDate = (a: SlideItem, b: SlideItem) => {
  const x = startMs(a);
  const y = startMs(b);
  return x === y ? 0 : x < y ? -1 : 1;
};
const compareName = (a: SlideItem, b: SlideItem) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });
const compareSlide = (a: SlideItem, b: SlideItem) => templateOrder(a.template) - templateOrder(b.template);

/** Chronological session order (undated last), then by title. */
export const compareSessions = (a: SlideItem, b: SlideItem) => compareDate(a, b) || compareName(a, b);

/** Primary comparator, then the others as stable tie-breakers. */
const COMPARATORS: Record<SortKey, ((a: SlideItem, b: SlideItem) => number)[]> = {
  // Same start time → keep each session's slides together.
  date: [compareDate, compareName, compareSlide],
  name: [compareName, compareDate, compareSlide],
  slide: [compareSlide, compareDate, compareName],
};

export function filterAndSortSlides(items: SlideItem[], query: SlideQuery): SlideItem[] {
  const terms = query.search.toLowerCase().split(/\s+/).filter(Boolean);

  const filtered = items.filter((item) => {
    if (query.template && item.template !== query.template) return false;
    if (query.day && (!item.session?.start || eventDayKey(item.session.start) !== query.day)) return false;
    if (query.room && item.session?.room !== query.room) return false;
    if (terms.length) {
      const text = searchText(item);
      if (!terms.every((t) => text.includes(t))) return false;
    }
    return true;
  });

  const [primary, ...rest] = COMPARATORS[query.sort.key];
  const sign = query.sort.dir === 'asc' ? 1 : -1;
  return filtered.sort((a, b) => {
    // Undated slides (e.g. the Holding slide) stay at the end in either direction.
    const undated = Number(startMs(a) === Infinity) - Number(startMs(b) === Infinity);
    if (query.sort.key === 'date' && undated) return undated;
    const first = primary!(a, b) * sign;
    if (first) return first;
    for (const cmp of rest) {
      const r = cmp(a, b);
      if (r) return r;
    }
    return 0;
  });
}
