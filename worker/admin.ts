import type { AdminResponse } from '../shared/types';
import { syncFromAirtable } from './sync';

const json = (body: AdminResponse, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Constant-time comparison so secrets can't be guessed by timing responses. */
function secretMatches(provided: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  return a.byteLength === b.byteLength ? crypto.subtle.timingSafeEqual(a, b) : !crypto.subtle.timingSafeEqual(b, b);
}

/** Admin-only routes require the `X-Admin-Passcode` header to match the ADMIN_PASSCODE secret. */
export function checkAdmin(request: Request, env: Env): Response | null {
  if (!env.ADMIN_PASSCODE) return json({ ok: false, error: 'Admin passcode is not configured on the server' }, 503);
  if (!secretMatches(request.headers.get('X-Admin-Passcode') ?? '', env.ADMIN_PASSCODE)) {
    return json({ ok: false, error: 'Incorrect admin passcode' }, 401);
  }
  return null;
}

interface BizzaboResult {
  ok: boolean;
  errors?: string[];
  durationMs?: number;
}

/**
 * Run one of the Bizzabo → Airtable workers via its manual trigger and wait for it.
 * Both accept the same bearer secret (their MANUAL_SYNC_SECRET = our BIZZABO_SYNC_SECRET).
 */
async function runBizzaboWorker(worker: Fetcher, name: string, secret: string): Promise<BizzaboResult> {
  try {
    // The hostname is ignored by service bindings; the request goes straight to the worker's fetch handler.
    const res = await worker.fetch(`https://${name}/`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
    const result = (await res.json().catch(() => ({ ok: false, errors: [`responded ${res.status}`] }))) as BizzaboResult;
    return !res.ok && result.ok ? { ok: false, errors: [`responded ${res.status}`] } : result;
  } catch (err) {
    return { ok: false, errors: [`couldn't be reached: ${(err as Error).message}`] };
  }
}

/**
 * "Fetch Bizzabo": run both Bizzabo → Airtable workers at once and wait for them —
 * airtable-bizzabo-sync (sessions/agenda) and airtable-bizzabo-tickets
 * (Registrations, for badges) — then re-sync this app from Airtable so slides
 * reflect it. New registrations get badges on the next 15-minute run.
 */
export async function handleBizzaboFetch(request: Request, env: Env): Promise<Response> {
  const denied = checkAdmin(request, env);
  if (denied) return denied;
  if (!env.BIZZABO_SYNC_SECRET) return json({ ok: false, error: 'BIZZABO_SYNC_SECRET is not configured' }, 503);

  const [sessions, tickets] = await Promise.all([
    runBizzaboWorker(env.BIZZABO_SYNC, 'airtable-bizzabo-sync', env.BIZZABO_SYNC_SECRET),
    runBizzaboWorker(env.BIZZABO_TICKETS, 'airtable-bizzabo-tickets', env.BIZZABO_SYNC_SECRET),
  ]);
  const failures = [
    !sessions.ok && `Sessions: ${sessions.errors?.join('; ') || 'failed'}`,
    !tickets.ok && `Registrations: ${tickets.errors?.join('; ') || 'failed'}`,
  ].filter((f): f is string => !!f);

  // Session data is now in Airtable — pull it into the slides right away (even if only the tickets failed).
  if (sessions.ok) {
    try {
      const snapshot = await syncFromAirtable(env, { force: true });
      if (!failures.length) return json({ ok: true, snapshot });
    } catch (err) {
      failures.push(`Slide sync: ${(err as Error).message}`);
    }
  }
  return json({ ok: false, error: failures.join(' · ') }, 502);
}
