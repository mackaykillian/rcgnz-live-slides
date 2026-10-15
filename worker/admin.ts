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
 * "Fetch Bizzabo": run the airtable-bizzabo-sync worker (Bizzabo → Airtable)
 * and wait for it, then re-sync this app from Airtable so slides reflect it.
 */
export async function handleBizzaboFetch(request: Request, env: Env): Promise<Response> {
  const denied = checkAdmin(request, env);
  if (denied) return denied;
  if (!env.BIZZABO_SYNC_SECRET) return json({ ok: false, error: 'BIZZABO_SYNC_SECRET is not configured' }, 503);

  let result: BizzaboResult;
  try {
    // The hostname is ignored by service bindings; the request goes straight to the worker's fetch handler.
    const res = await env.BIZZABO_SYNC.fetch('https://airtable-bizzabo-sync/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.BIZZABO_SYNC_SECRET}` },
    });
    result = (await res.json().catch(() => ({ ok: false, errors: [`Bizzabo worker responded ${res.status}`] }))) as BizzaboResult;
    if (!res.ok && result.ok) result = { ok: false, errors: [`Bizzabo worker responded ${res.status}`] };
  } catch (err) {
    return json({ ok: false, error: `Couldn't reach the Bizzabo worker: ${(err as Error).message}` }, 502);
  }

  if (!result.ok) {
    return json({ ok: false, error: result.errors?.join('; ') || 'Bizzabo fetch failed' }, 502);
  }

  // Bizzabo data is now in Airtable — pull it into the slides right away.
  try {
    const snapshot = await syncFromAirtable(env, { force: true });
    return json({ ok: true, snapshot });
  } catch (err) {
    return json({ ok: false, error: `Bizzabo fetch succeeded, but the slide sync failed: ${(err as Error).message}` }, 502);
  }
}
