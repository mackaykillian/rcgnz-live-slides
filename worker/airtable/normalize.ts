import type { ImageRef, Session, Speaker, SpeakerHeadshots } from '../../shared/types';
import type { AirtableAttachment, AirtableRecord } from './client';
import { AIRTABLE } from './fieldMap';

/** attachment id → short-lived Airtable URL, used by the image route to fill the R2 cache. */
export type ImageSources = Record<string, string>;

export function imageUrl(id: string): string {
  return `/api/images/${encodeURIComponent(id)}`;
}

// ---- Field value coercion -------------------------------------------------
// Airtable returns different JSON shapes per field type (text, select, link,
// lookup, attachment…). These helpers accept any of them so a field-type change
// in Airtable doesn't break the sync.

export function asText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(asText).filter((v): v is string => !!v);
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof value === 'object' && 'name' in value) return asText((value as { name: unknown }).name);
  return null;
}

export function asTextList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(asText).filter((v): v is string => !!v);
  const text = asText(value);
  return text ? text.split(',').map((t) => t.trim()).filter(Boolean) : [];
}

export function asRecordIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.startsWith('rec'))
    : [];
}

export function asAttachment(value: unknown): AirtableAttachment | null {
  if (!Array.isArray(value)) return null;
  const first = value.find(
    (v): v is AirtableAttachment =>
      !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.url === 'string',
  );
  return first ?? null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = asText(value);
  const n = text == null ? NaN : Number(text);
  return Number.isFinite(n) ? n : null;
}

export function asBoolean(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(asBoolean);
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

export function asIsoDate(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---- Records → domain -----------------------------------------------------

export interface NormalizeInput {
  sessions: AirtableRecord[];
  speakers: AirtableRecord[];
  headshots: AirtableRecord[];
}

export interface NormalizeOutput {
  sessions: Session[];
  speakers: Record<string, Speaker>;
  imageSources: ImageSources;
  warnings: string[];
}

export function normalize({ sessions, speakers, headshots }: NormalizeInput): NormalizeOutput {
  const imageSources: ImageSources = {};
  const warnings: string[] = [];
  const S = AIRTABLE.sessions.fields;
  const P = AIRTABLE.speakers.fields;
  const H = AIRTABLE.headshots.fields;

  const toImage = (value: unknown): ImageRef | undefined => {
    const att = asAttachment(value);
    if (!att) return undefined;
    imageSources[att.id] = att.url;
    return { id: att.id, url: imageUrl(att.id) };
  };

  const headshotsById = new Map<string, SpeakerHeadshots>();
  for (const rec of headshots) {
    headshotsById.set(rec.id, {
      transparent: toImage(rec.fields[H.transparent]),
      sunset: toImage(rec.fields[H.sunset]),
      aqua: toImage(rec.fields[H.aqua]),
    });
  }

  const outSessions: Session[] = sessions.map((rec) => {
    const title = asText(rec.fields[S.title]);
    const start = asIsoDate(rec.fields[S.start]);
    if (!title) warnings.push(`Session ${rec.id} has no "${S.title}".`);
    if (!start) warnings.push(`"${title ?? rec.id}" has no "${S.start}".`);
    return {
      id: rec.id,
      title: title ?? 'Untitled session',
      start,
      end: asIsoDate(rec.fields[S.end]),
      tags: asTextList(rec.fields[S.tags]),
      room: S.room ? asText(rec.fields[S.room]) : null,
      shrmCode: asText(rec.fields[S.shrmCode]),
      registration: toRegistration(rec.fields[S.registration], rec.fields[S.registrationCount], rec.fields[S.registrationCapacity]),
      speakerIds: asRecordIds(rec.fields[S.speakers]),
    };
  });

  // Only keep speakers referenced by this event's sessions.
  const wanted = new Set(outSessions.flatMap((s) => s.speakerIds));
  const outSpeakers: Record<string, Speaker> = {};
  for (const rec of speakers) {
    if (!wanted.has(rec.id)) continue;
    const name = asText(rec.fields[P.name]) ?? 'Unnamed speaker';
    const [headshotId] = asRecordIds(rec.fields[P.headshot]);
    const shots = (headshotId && headshotsById.get(headshotId)) || {};
    if (!shots.transparent && !shots.sunset && !shots.aqua) {
      warnings.push(`${name} has no headshot.`);
    }
    outSpeakers[rec.id] = {
      id: rec.id,
      name,
      jobTitle: asText(rec.fields[P.jobTitle]),
      company: asText(rec.fields[P.company]),
      headshots: shots,
    };
  }

  // Drop links to speakers that weren't returned (deleted / other base view).
  for (const session of outSessions) {
    session.speakerIds = session.speakerIds.filter((id) => outSpeakers[id]);
  }

  return { sessions: outSessions, speakers: outSpeakers, imageSources, warnings };
}

/** Registration only counts when it's switched on and there's a real (positive) capacity. */
export function toRegistration(enabled: unknown, count: unknown, capacity: unknown): Session['registration'] {
  const cap = asNumber(capacity);
  if (!asBoolean(enabled) || cap == null || cap <= 0) return null;
  return { count: Math.max(0, asNumber(count) ?? 0), capacity: cap };
}

/** Airtable formula matching the event across text, single-select and linked-record fields. */
export function eventFormula(eventName: string): string {
  const escaped = eventName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `FIND('${escaped}', {${AIRTABLE.sessions.fields.event}} & '')`;
}
