import type { Snapshot } from '../shared/types';
import { listAllRecords } from './airtable/client';
import { AIRTABLE } from './airtable/fieldMap';
import { eventFormula, normalize, type ImageSources } from './airtable/normalize';
import mockData from './mock-data.json';

export const SNAPSHOT_KEY = 'snapshot.json';
export const IMAGE_SOURCES_KEY = 'image-sources.json';

/** Manual syncs within this window return the current snapshot instead of hitting Airtable again. */
const MIN_SYNC_INTERVAL_MS = 15_000;

export function isMockMode(env: Env): boolean {
  return !env.AIRTABLE_TOKEN;
}

export async function readSnapshot(env: Env): Promise<Snapshot | null> {
  return env.STORE.get<Snapshot>(SNAPSHOT_KEY, 'json');
}

export async function readImageSources(env: Env): Promise<ImageSources> {
  if (isMockMode(env)) return mockData.imageSources;
  return (await env.STORE.get<ImageSources>(IMAGE_SOURCES_KEY, 'json')) ?? {};
}

/**
 * Pull the event's sessions + speakers + headshots from Airtable, normalize,
 * and store the snapshot in KV. Images are NOT downloaded here — the image
 * route fills the KV cache lazily — so a sync stays within Worker subrequest
 * limits no matter how many speakers there are.
 */
export async function syncFromAirtable(env: Env, { force = false } = {}): Promise<Snapshot> {
  if (!force) {
    const current = await readSnapshot(env);
    if (current && Date.now() - Date.parse(current.syncedAt) < MIN_SYNC_INTERVAL_MS) {
      return current;
    }
  }

  if (isMockMode(env)) {
    const snapshot: Snapshot = {
      ...(mockData.snapshot as Snapshot),
      syncedAt: new Date().toISOString(),
    };
    await env.STORE.put(SNAPSHOT_KEY, JSON.stringify(snapshot));
    return snapshot;
  }

  const token = env.AIRTABLE_TOKEN;
  const base = env.AIRTABLE_BASE_ID;
  const S = AIRTABLE.sessions;
  const P = AIRTABLE.speakers;
  const H = AIRTABLE.headshots;

  const sessionFields = Object.values(S.fields).filter((f): f is string => !!f);
  const [sessions, speakers, headshots] = await Promise.all([
    listAllRecords(token, base, S.table, {
      filterByFormula: eventFormula(env.EVENT_NAME),
      fields: sessionFields,
    }),
    listAllRecords(token, base, P.table, { fields: Object.values(P.fields) }),
    listAllRecords(token, base, H.table, { fields: Object.values(H.fields) }),
  ]);

  const result = normalize({ sessions, speakers, headshots });
  const snapshot: Snapshot = {
    eventName: env.EVENT_NAME,
    syncedAt: new Date().toISOString(),
    source: 'airtable',
    sessions: result.sessions,
    speakers: result.speakers,
    warnings: result.warnings,
  };

  // Merge so images referenced by an older snapshot can still be resolved.
  const previous = await readImageSources(env);
  await Promise.all([
    env.STORE.put(IMAGE_SOURCES_KEY, JSON.stringify({ ...previous, ...result.imageSources })),
    env.STORE.put(SNAPSHOT_KEY, JSON.stringify(snapshot)),
  ]);
  return snapshot;
}
