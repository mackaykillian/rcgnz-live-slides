/**
 * Data contract between the Worker (which syncs Airtable) and the React app.
 * The Worker normalizes Airtable records into this shape so the UI and slide
 * templates never see raw Airtable field names.
 */

/** An image served by the Worker from R2 (`/api/images/:id`). */
export interface ImageRef {
  /** Stable id (the Airtable attachment id) — also the R2 cache key. */
  id: string;
  /** Same-origin URL the app should render, e.g. `/api/images/attXXXX`. */
  url: string;
}

export interface SpeakerHeadshots {
  /** Cut-out headshot with no background. Used as the fallback. */
  transparent?: ImageRef;
  /** Pre-composed on the Sunset themed background. */
  sunset?: ImageRef;
  /** Pre-composed on the Aqua themed background. */
  aqua?: ImageRef;
}

export interface Speaker {
  id: string;
  name: string;
  jobTitle: string | null;
  company: string | null;
  headshots: SpeakerHeadshots;
}

export interface Session {
  id: string;
  title: string;
  /** ISO 8601 (UTC). Null when the agenda item has no time yet. */
  start: string | null;
  end: string | null;
  /** Free-form session tags (session type, themes, …). */
  tags: string[];
  /** Room name. Not in Airtable yet — always null for now. */
  room: string | null;
  shrmCode: string | null;
  /** Speakers in Airtable order. Ids resolve via `Snapshot.speakers`. */
  speakerIds: string[];
}

export interface Snapshot {
  eventName: string;
  /** ISO timestamp of the sync that produced this snapshot. */
  syncedAt: string;
  /** `mock` when no Airtable token is configured (local development). */
  source: 'airtable' | 'mock';
  sessions: Session[];
  speakers: Record<string, Speaker>;
  /** Non-fatal data problems surfaced in the UI (missing fields, etc.). */
  warnings: string[];
}

export interface SyncResponse {
  ok: boolean;
  snapshot?: Snapshot;
  error?: string;
}

/** Response from admin actions (e.g. Fetch Bizzabo). */
export interface AdminResponse {
  ok: boolean;
  /** Fresh snapshot when the action also re-synced the slides. */
  snapshot?: Snapshot;
  error?: string;
}
