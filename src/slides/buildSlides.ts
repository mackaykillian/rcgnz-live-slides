import type { Snapshot, Speaker } from '../../shared/types';
import {
  MAX_SPEAKERS,
  SPEAKER_TEMPLATES,
  STATIC_TEMPLATES,
  sessionSlideId,
  staticSlideId,
  templateById,
  type SlideItem,
  type TemplateId,
} from './templates';

export const staticSlide = (template: TemplateId): SlideItem => ({
  id: staticSlideId(template),
  template,
  session: null,
  speakers: [],
  title: templateById[template].label,
  issues: [],
});

export const HOLDING_SLIDE = staticSlide('holding');

/**
 * Expand the synced sessions into one slide per (session × speaker template),
 * plus one slide per static template (e.g. Holding). Sessions without speakers (meals, receptions,
 * networking…) get no slides — the speaker templates have nothing to show.
 */
export function buildSlides(snapshot: Snapshot): SlideItem[] {
  const slides: SlideItem[] = [];

  for (const session of snapshot.sessions) {
    const speakers = session.speakerIds
      .map((id) => snapshot.speakers[id])
      .filter((s): s is Speaker => !!s);
    if (speakers.length === 0) continue;

    const baseIssues: string[] = [];
    if (speakers.length > MAX_SPEAKERS) {
      baseIssues.push(`${speakers.length} speakers — only the first ${MAX_SPEAKERS} fit on the slide`);
    }
    if (!session.start) baseIssues.push('No start time');

    for (const template of SPEAKER_TEMPLATES) {
      const issues = [...baseIssues];
      if (template === 'shrm' && !session.shrmCode) issues.push('No SHRM code in Airtable');
      slides.push({
        id: sessionSlideId(session.id, template),
        template,
        session,
        speakers: speakers.slice(0, MAX_SPEAKERS),
        title: session.title,
        issues,
      });
    }
  }

  for (const template of STATIC_TEMPLATES) slides.push(staticSlide(template));
  return slides;
}
