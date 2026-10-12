/**
 * Slideshow ("deck") engine.
 *
 * A deck is an ordered array of entries. Each entry points at a generated slide
 * by its SlideId and has a `key` that is unique within the deck, so the same
 * slide (e.g. the Holding slide) can appear many times and each appearance can
 * still be addressed individually.
 *
 *   ruleset(slides) → entries → overrides → resolved deck
 *
 * Rulesets do the automatic ordering. Overrides are the escape hatch for manual
 * edits (one-off inserts, removals, moves) and target entries by key, so they
 * keep working when unrelated sessions are added or rescheduled.
 */
import { compareSessions } from '../lib/filterSlides';
import { SPEAKER_TEMPLATES, staticSlideId, type SlideId, type SlideItem, type TemplateId } from '../slides/templates';

export interface DeckEntry {
  /** Unique within the deck. For session slides this is the SlideId itself. */
  key: string;
  slideId: SlideId;
}

export type DeckRuleset = (slides: SlideItem[]) => DeckEntry[];

/** Position relative to another entry's key. Omit both to target the end of the deck. */
type Anchor = { after?: string; before?: string };

export type DeckOverride =
  | ({ op: 'insert'; slideId: SlideId; key?: string } & Anchor)
  | { op: 'remove'; key: string }
  | ({ op: 'move'; key: string } & Anchor);

export interface DeckDefinition {
  /** URL slug — keep stable once shared (`#/slideshow/<id>`). */
  id: string;
  name: string;
  build: DeckRuleset;
  overrides?: DeckOverride[];
}

export interface DeckItem {
  key: string;
  slide: SlideItem;
}

export interface ResolvedDeck {
  definition: DeckDefinition;
  items: DeckItem[];
  /** Overrides/entries that couldn't be applied (e.g. slide no longer exists). */
  warnings: string[];
}

// ---- Rulesets ---------------------------------------------------------------

export interface RoomRulesetOptions {
  /** `Session.room` value to include. */
  room: string;
  /** Per-session slide order. Default: Upcoming → Standard → SHRM. */
  templates?: TemplateId[];
  /** Slide placed around each session's group. Null for none. Default: Holding. */
  separator?: SlideId | null;
  /** Where the separator goes. Default: before the first session, between sessions, after the last. */
  separatorAt?: { start?: boolean; between?: boolean; end?: boolean };
}

/**
 * Every session in a room, by start time; each session's slides in template
 * order; a separator (the Holding slide) around the groups.
 *
 *   H · U S SHRM · H · U S SHRM · H
 */
export function roomRuleset({
  room,
  templates = SPEAKER_TEMPLATES,
  separator = staticSlideId('holding'),
  separatorAt = { start: true, between: true, end: true },
}: RoomRulesetOptions): DeckRuleset {
  return (slides) => {
    const bySession = new Map<string, SlideItem[]>();
    for (const slide of slides) {
      const session = slide.session;
      if (!session || session.room !== room || !templates.includes(slide.template)) continue;
      bySession.set(session.id, [...(bySession.get(session.id) ?? []), slide]);
    }

    const groups = [...bySession.values()]
      .sort((a, b) => compareSessions(a[0]!, b[0]!))
      .map((group) => group.sort((a, b) => templates.indexOf(a.template) - templates.indexOf(b.template)));

    const entries: DeckEntry[] = [];
    const addSeparator = (key: string) => separator && entries.push({ key: `${separator}@${key}`, slideId: separator });

    groups.forEach((group, i) => {
      const sessionId = group[0]!.session!.id;
      if ((i === 0 && separatorAt.start) || (i > 0 && separatorAt.between)) addSeparator(`before:${sessionId}`);
      for (const slide of group) entries.push({ key: slide.id, slideId: slide.id });
    });
    if (groups.length && separatorAt.end) addSeparator('end');

    return entries;
  };
}

// ---- Overrides --------------------------------------------------------------

function anchorIndex(entries: DeckEntry[], anchor: Anchor): number | null {
  if (anchor.after) {
    const i = entries.findIndex((e) => e.key === anchor.after);
    return i < 0 ? null : i + 1;
  }
  if (anchor.before) {
    const i = entries.findIndex((e) => e.key === anchor.before);
    return i < 0 ? null : i;
  }
  return entries.length;
}

export function applyOverrides(input: DeckEntry[], overrides: DeckOverride[] = []) {
  const entries = [...input];
  const warnings: string[] = [];

  for (const o of overrides) {
    if (o.op === 'remove') {
      const i = entries.findIndex((e) => e.key === o.key);
      if (i < 0) warnings.push(`remove: no entry "${o.key}"`);
      else entries.splice(i, 1);
      continue;
    }

    if (o.op === 'insert') {
      const key = o.key ?? `${o.slideId}@insert:${o.after ?? o.before ?? 'end'}`;
      const at = anchorIndex(entries, o);
      if (at == null) warnings.push(`insert: anchor not found for "${key}"`);
      else if (entries.some((e) => e.key === key)) warnings.push(`insert: duplicate key "${key}"`);
      else entries.splice(at, 0, { key, slideId: o.slideId });
      continue;
    }

    const from = entries.findIndex((e) => e.key === o.key);
    if (from < 0) {
      warnings.push(`move: no entry "${o.key}"`);
      continue;
    }
    const [entry] = entries.splice(from, 1);
    const at = anchorIndex(entries, o);
    if (at == null) {
      entries.splice(from, 0, entry!);
      warnings.push(`move: anchor not found for "${o.key}"`);
    } else entries.splice(at, 0, entry!);
  }

  return { entries, warnings };
}

// ---- Resolve ----------------------------------------------------------------

export function resolveDeck(definition: DeckDefinition, slides: SlideItem[]): ResolvedDeck {
  const byId = new Map(slides.map((s) => [s.id, s]));
  const { entries, warnings } = applyOverrides(definition.build(slides), definition.overrides);

  const items: DeckItem[] = [];
  for (const entry of entries) {
    const slide = byId.get(entry.slideId);
    if (slide) items.push({ key: entry.key, slide });
    else warnings.push(`Slide "${entry.slideId}" no longer exists`);
  }

  // A deck that is only separators has nothing to present.
  const hasContent = items.some((item) => item.slide.session);
  return { definition, items: hasContent ? items : [], warnings };
}
