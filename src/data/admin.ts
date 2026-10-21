import type { BadgeRegistration, BadgeResult, BadgeRunResponse, BadgesResponse } from '../../shared/badges';
import type { AdminResponse } from '../../shared/types';

const PASSCODE_KEY = 'rcgnz:adminPasscode';

export const getAdminPasscode = () => localStorage.getItem(PASSCODE_KEY);
export const setAdminPasscode = (passcode: string) => localStorage.setItem(PASSCODE_KEY, passcode);
export const clearAdminPasscode = () => localStorage.removeItem(PASSCODE_KEY);

export class AdminAuthError extends Error {}

/** Call an admin route; throws AdminAuthError on a wrong passcode. */
async function adminFetch(passcode: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, { ...init, headers: { ...init.headers, 'X-Admin-Passcode': passcode } });
  if (res.status === 401) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AdminAuthError(body.error ?? 'Incorrect admin passcode');
  }
  return res;
}

async function adminJson<T extends { ok: boolean; error?: string }>(passcode: string, path: string, init?: RequestInit): Promise<T> {
  const res = await adminFetch(passcode, path, init);
  const body = (await res.json().catch(() => ({ ok: false, error: `Request failed (${res.status})` }))) as T;
  if (!body.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

/** Run Bizzabo → Airtable, then Airtable → slides. Resolves with the fresh snapshot. */
export function fetchBizzabo(passcode: string): Promise<AdminResponse> {
  return adminJson<AdminResponse>(passcode, '/api/admin/bizzabo-fetch', { method: 'POST' });
}

/** Every registration with its badge status. */
export async function fetchBadges(passcode: string): Promise<BadgeRegistration[]> {
  return (await adminJson<BadgesResponse>(passcode, '/api/admin/badges')).registrations ?? [];
}

/** Render + upload badges now (at most 10 per call). */
export async function generateBadges(passcode: string, recordIds: string[]): Promise<BadgeResult[]> {
  const body = await adminJson<BadgeRunResponse>(passcode, '/api/admin/badges/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recordIds }),
  });
  return body.results ?? [];
}

async function adminBlob(passcode: string, path: string): Promise<Blob> {
  const res = await adminFetch(passcode, path);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.blob();
}

/** The print PDF exactly as it would be uploaded, without uploading it. */
export function previewBadgePdf(passcode: string, recordId: string): Promise<Blob> {
  return adminBlob(passcode, `/api/admin/badges/${recordId}/preview`);
}

/** One Airtable Batch as a single PDF (a page per badge) for the printer. */
export function downloadBatchPdf(passcode: string, batch: string): Promise<Blob> {
  return adminBlob(passcode, `/api/admin/badges/batches/${encodeURIComponent(batch)}`);
}
