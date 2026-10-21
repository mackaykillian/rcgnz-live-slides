import type { BadgeData, BadgeResult, BadgeRunResponse, BadgesResponse } from '../../shared/badges';
import { checkAdmin } from '../admin';
import { isMockMode } from '../sync';
import {
  badgeFingerprint,
  badgeStatus,
  listBadgeRegistrations,
  readFingerprints,
  readRegistrations,
  saveFingerprints,
  type Fingerprints,
  type RegistrationRow,
} from './registrations';
import { withBadgeRenderer } from './render';
import { writeBadge } from './upload';

/** Badges per admin request — keeps each request well under a minute. */
export const MAX_BATCH = 10;
/** New/changed badges handled per 15-minute cron run. */
const CRON_LIMIT = 25;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

const filePart = (text: string) => text.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

export function badgeFileNames(row: Pick<RegistrationRow, 'recordId' | 'registrationId'>, data: BadgeData) {
  const id = row.registrationId ?? row.recordId;
  const name = filePart(`${data.firstName}${data.lastName}`) || 'Badge';
  return { badge: `Badge_${id}_${name}.png`, qr: `QR_${id}_${name}.png` };
}

/** Render + upload badges for `rows`. Fingerprints are saved even if a later badge fails. */
async function generate(env: Env, origin: string, rows: RegistrationRow[]): Promise<BadgeResult[]> {
  const results: BadgeResult[] = [];
  const done: Fingerprints = {};
  const todo = rows.filter((row) => {
    if (row.data) return true;
    results.push({ recordId: row.recordId, ok: false, error: row.invalidReason ?? 'Invalid registration' });
    return false;
  });
  if (!todo.length) return results;

  try {
    await withBadgeRenderer(env, origin, async (render) => {
      for (const row of todo) {
        const data = row.data!;
        try {
          const pngs = await render(data);
          const names = badgeFileNames(row, data);
          await writeBadge(env, row.recordId, {
            badge: { name: names.badge, png: pngs.badge },
            qr: { name: names.qr, png: pngs.qr },
          });
          done[row.recordId] = await badgeFingerprint(data);
          results.push({ recordId: row.recordId, ok: true });
        } catch (err) {
          console.error(`Badge ${row.recordId} failed`, err);
          results.push({ recordId: row.recordId, ok: false, error: (err as Error).message });
        }
      }
    });
  } catch (err) {
    // The browser itself failed — everything not yet attempted fails with it.
    const message = `Badge renderer failed: ${(err as Error).message}`;
    for (const row of todo) {
      if (!results.some((r) => r.recordId === row.recordId)) results.push({ recordId: row.recordId, ok: false, error: message });
    }
  } finally {
    await saveFingerprints(env, done);
  }
  return results;
}

/** Cron: generate badges for new registrations and ones whose details changed. */
export async function generatePendingBadges(env: Env): Promise<void> {
  if (isMockMode(env)) return;
  const [rows, fingerprints] = await Promise.all([readRegistrations(env), readFingerprints(env)]);
  const pending: RegistrationRow[] = [];
  for (const row of rows) {
    if (pending.length >= CRON_LIMIT) break;
    if ((await badgeStatus(row, fingerprints)).status === 'pending') pending.push(row);
  }
  if (!pending.length) return;
  const results = await generate(env, env.PUBLIC_ORIGIN, pending);
  const failed = results.filter((r) => !r.ok);
  console.log(`Badges: generated ${results.length - failed.length}, failed ${failed.length}`);
  if (failed.length) console.error('Badge failures', failed);
}

/** GET /api/admin/badges — every registration with its badge status. */
export async function handleListBadges(request: Request, env: Env): Promise<Response> {
  const denied = checkAdmin(request, env);
  if (denied) return denied;
  if (isMockMode(env)) return json({ ok: false, error: 'Badges need an Airtable token' } satisfies BadgesResponse, 503);
  try {
    return json({ ok: true, registrations: await listBadgeRegistrations(env) } satisfies BadgesResponse);
  } catch (err) {
    return json({ ok: false, error: (err as Error).message } satisfies BadgesResponse, 502);
  }
}

/** POST /api/admin/badges/generate `{ recordIds }` — (re)generate these badges now, whatever their status. */
export async function handleGenerateBadges(request: Request, env: Env): Promise<Response> {
  const denied = checkAdmin(request, env);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { recordIds?: unknown } | null;
  const recordIds = Array.isArray(body?.recordIds)
    ? body.recordIds.filter((id): id is string => typeof id === 'string' && /^rec\w+$/.test(id))
    : [];
  if (!recordIds.length || recordIds.length > MAX_BATCH) {
    return json({ ok: false, error: `Send 1–${MAX_BATCH} record ids` } satisfies BadgeRunResponse, 400);
  }

  try {
    const rows = await readRegistrations(env, recordIds);
    const results = await generate(env, new URL(request.url).origin, rows);
    for (const id of recordIds) {
      if (!rows.some((r) => r.recordId === id)) results.push({ recordId: id, ok: false, error: 'Registration not found' });
    }
    return json({ ok: true, results } satisfies BadgeRunResponse);
  } catch (err) {
    return json({ ok: false, error: (err as Error).message } satisfies BadgeRunResponse, 502);
  }
}

/** GET /api/admin/badges/:recordId/preview.png[?part=qr] — render without uploading. */
export async function handlePreviewBadge(request: Request, env: Env, recordId: string): Promise<Response> {
  const denied = checkAdmin(request, env);
  if (denied) return denied;
  const [row] = await readRegistrations(env, [recordId]);
  if (!row) return json({ ok: false, error: 'Registration not found' }, 404);
  if (!row.data) return json({ ok: false, error: row.invalidReason }, 422);

  const url = new URL(request.url);
  const pngs = await withBadgeRenderer(env, url.origin, (render) => render(row.data!));
  const qr = url.searchParams.get('part') === 'qr';
  const names = badgeFileNames(row, row.data);
  return new Response(qr ? pngs.qr : pngs.badge, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${qr ? names.qr : names.badge}"`,
      'Cache-Control': 'no-store',
    },
  });
}
