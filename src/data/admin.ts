import type { AdminResponse } from '../../shared/types';

const PASSCODE_KEY = 'rcgnz:adminPasscode';

export const getAdminPasscode = () => localStorage.getItem(PASSCODE_KEY);
export const setAdminPasscode = (passcode: string) => localStorage.setItem(PASSCODE_KEY, passcode);
export const clearAdminPasscode = () => localStorage.removeItem(PASSCODE_KEY);

export class AdminAuthError extends Error {}

/** Run Bizzabo → Airtable, then Airtable → slides. Resolves with the fresh snapshot. */
export async function fetchBizzabo(passcode: string): Promise<AdminResponse> {
  const res = await fetch('/api/admin/bizzabo-fetch', {
    method: 'POST',
    headers: { 'X-Admin-Passcode': passcode },
  });
  const body = (await res.json().catch(() => ({ ok: false, error: `Request failed (${res.status})` }))) as AdminResponse;
  if (res.status === 401) throw new AdminAuthError(body.error ?? 'Incorrect admin passcode');
  if (!body.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}
