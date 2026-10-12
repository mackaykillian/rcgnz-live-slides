import type { Session, Speaker } from '../../shared/types';

/**
 * Every slide template. Order here = order in the sidebar, filters and "Slide" sort.
 *
 * - `speakers`: dynamic — one slide per session, only for sessions that have speakers.
 * - `static`: one fixed slide, no Airtable data.
 */
export const TEMPLATES = [
  { id: 'upcoming', label: 'Upcoming session', fileLabel: 'UpcomingSession', kind: 'speakers' },
  { id: 'standard', label: 'Standard', fileLabel: 'Standard', kind: 'speakers' },
  { id: 'shrm', label: 'SHRM Code', fileLabel: 'SHRMCode', kind: 'speakers' },
  { id: 'holding', label: 'Holding Slide', fileLabel: 'HoldingSlide', kind: 'static' },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]['id'];

export const templateById = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<
  TemplateId,
  (typeof TEMPLATES)[number]
>;

export const templateOrder = (id: TemplateId) => TEMPLATES.findIndex((t) => t.id === id);

export function isTemplateId(value: string | undefined): value is TemplateId {
  return TEMPLATES.some((t) => t.id === value);
}

/** Templates generated per session (requires at least one speaker). */
export const SPEAKER_TEMPLATES: TemplateId[] = TEMPLATES.filter((t) => t.kind === 'speakers').map((t) => t.id);

/** Templates rendered once, with no Airtable data. */
export const STATIC_TEMPLATES: TemplateId[] = TEMPLATES.filter((t) => t.kind === 'static').map((t) => t.id);

/**
 * Slide ids — the stable address of every generated slide. Slideshows,
 * selections and links all reference slides by these ids.
 *
 *   session slide  `${sessionRecordId}:${template}`   e.g. `recAbC123:upcoming`
 *   static slide   `static:${template}`               e.g. `static:holding`
 *
 * Session ids come from Airtable record ids, so they survive renames and re-syncs.
 */
export type SlideId = string;
export const sessionSlideId = (sessionId: string, template: TemplateId): SlideId => `${sessionId}:${template}`;
export const staticSlideId = (template: TemplateId): SlideId => `static:${template}`;

/** The speaker layouts in Figma cover 1–5 speakers. */
export const MAX_SPEAKERS = 5;

/** One generated slide instance — a template applied to a session. */
export interface SlideItem {
  /** See `sessionSlideId` / `staticSlideId`. */
  id: SlideId;
  template: TemplateId;
  /** Null for static slides (e.g. the Holding slide). */
  session: Session | null;
  speakers: Speaker[];
  title: string;
  /** Data problems worth flagging on this slide's card. */
  issues: string[];
}
