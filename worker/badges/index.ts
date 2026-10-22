import { MAX_BADGES_PER_BATCH, type BadgeResult, type BadgeRunResponse, type BadgesResponse } from '../../shared/badges';
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

/** Letters and digits only (accents dropped), so names sort and travel safely. */
const filePart = (text: string) => text.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

/** LastName_FirstName_RegistrationID — sorts by last name in the printer's folders. */
export function badgeFileNames(row: Pick<RegistrationRow, 'recordId' | 'registrationId' | 'data'>) {
  const base = [row.data?.lastName, row.data?.firstName, String(row.registrationId ?? row.recordId)]
    .map((part) => filePart(part ?? ''))
    .filter(Boolean)
    .join('_');
  return { badge: `${base}.pdf`, qr: `${base}_QR.png` };
}

const byName = (a: RegistrationRow, b: RegistrationRow) =>
  (a.data?.lastName ?? '').localeCompare(b.data?.lastName ?? '') ||
  (a.data?.firstName ?? '').localeCompare(b.data?.firstName ?? '') ||
  (a.registrationId ?? 0) - (b.registrationId ?? 0);

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
          const files = await render.badge(data);
          const names = badgeFileNames(row);
          const generatedAt = await writeBadge(env, row.recordId, {
            badge: { name: names.badge, contentType: 'application/pdf', bytes: files.pdf },
            qr: { name: names.qr, contentType: 'image/png', bytes: files.qr },
          });
          done[row.recordId] = await badgeFingerprint(data);
          results.push({ recordId: row.recordId, ok: true, generatedAt });
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

/** GET /api/admin/badges/:recordId/preview[?part=qr] — the badge PDF (or QR PNG), without uploading. */
export async function handlePreviewBadge(request: Request, env: Env, recordId: string): Promise<Response> {
  const denied = checkAdmin(request, env);
  if (denied) return denied;
  try {
    const [row] = await readRegistrations(env, [recordId]);
    if (!row) return json({ ok: false, error: 'Registration not found' }, 404);
    if (!row.data) return json({ ok: false, error: row.invalidReason }, 422);

    const url = new URL(request.url);
    const files = await withBadgeRenderer(env, url.origin, (render) => render.badge(row.data!));
    const qr = url.searchParams.get('part') === 'qr';
    const names = badgeFileNames(row);
    return new Response(qr ? files.qr : files.pdf, {
      headers: {
        'Content-Type': qr ? 'image/png' : 'application/pdf',
        'Content-Disposition': `inline; filename="${qr ? names.qr : names.badge}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Badge preview failed', err);
    return json({ ok: false, error: (err as Error).message }, 502);
  }
}

/** Render rows (valid ones, sorted by last name) as one PDF download. */
async function sheetResponse(request: Request, env: Env, rows: RegistrationRow[], label: string): Promise<Response> {
  const valid = rows.filter((r) => r.data).sort(byName);
  if (!valid.length) return json({ ok: false, error: 'No printable badges selected' }, 404);
  if (valid.length > MAX_BADGES_PER_BATCH) {
    return json({ ok: false, error: `${valid.length} badges — the printer takes at most ${MAX_BADGES_PER_BATCH} per PDF.` }, 422);
  }
  const pdf = await withBadgeRenderer(env, new URL(request.url).origin, (render) => render.sheet(valid.map((r) => r.data!)));
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="RCGNZ-Badges_${filePart(label) || 'Selection'}_${valid.length}.pdf"`,
      'X-Badge-Count': String(valid.length),
      'X-Badges-Skipped': String(rows.length - valid.length),
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * POST /api/admin/badges/pdf `{ recordIds, label }` — the selected badges as one PDF
 * (a page each, sorted by last name, at most 100). `label` names the file, e.g. "Batch 1".
 */
export async function handleSelectionPdf(request: Request, env: Env): Promise<Response> {
  const denied = checkAdmin(request, env);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { recordIds?: unknown; label?: unknown } | null;
  const recordIds = Array.isArray(body?.recordIds)
    ? [...new Set(body.recordIds.filter((id): id is string => typeof id === 'string' && /^rec\w+$/.test(id)))]
    : [];
  if (!recordIds.length) return json({ ok: false, error: 'Select at least one badge' }, 400);
  if (recordIds.length > MAX_BADGES_PER_BATCH) {
    return json({ ok: false, error: `The printer takes at most ${MAX_BADGES_PER_BATCH} badges per PDF` }, 422);
  }
  try {
    const label = typeof body?.label === 'string' ? body.label : 'Selection';
    return await sheetResponse(request, env, await readRegistrations(env, recordIds), label);
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 502);
  }
}

/**
 * GET /api/admin/badges/batches/:batch — every badge in one Airtable Batch as a
 * single PDF (a page each, sorted by last name) for the printer. Rendered from
 * the current Airtable data, so it matches the per-registration PDFs.
 */
export async function handleBatchPdf(request: Request, env: Env, batch: string): Promise<Response> {
  const denied = checkAdmin(request, env);
  if (denied) return denied;
  try {
    return await sheetResponse(request, env, await readRegistrations(env, { batch }), batch);
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 502);
  }
}
