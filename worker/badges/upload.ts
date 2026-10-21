import type { AirtableAttachment } from '../airtable/client';
import { AIRTABLE } from '../airtable/fieldMap';

const R = AIRTABLE.registrations;

/** Airtable allows 5 requests/second per base; stay under it. */
const MIN_GAP_MS = 220;
let lastRequestAt = 0;

async function airtableRequest(env: Env, url: string, init: RequestInit): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();

    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
    });
    // Over the rate limit (e.g. the Bizzabo sync writing at the same time): Airtable asks for a 30s pause.
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

interface UploadResponse {
  fields: Record<string, AirtableAttachment[]>;
}

/** Upload a PNG into an attachment field (appends). Returns the new attachment's id. */
async function uploadPng(env: Env, recordId: string, field: string, filename: string, png: Uint8Array): Promise<string> {
  const url = `https://content.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${recordId}/${encodeURIComponent(field)}/uploadAttachment`;
  const body = (await airtableRequest(env, url, {
    method: 'POST',
    body: JSON.stringify({ contentType: 'image/png', filename, file: toBase64(png) }),
  })) as UploadResponse;
  // The response lists the field's attachments (keyed by field id); the upload is appended last.
  const attachments = Object.values(body.fields)[0] ?? [];
  const added = attachments[attachments.length - 1];
  if (!added) throw new Error(`Upload to "${field}" returned no attachment`);
  return added.id;
}

/**
 * Replace the record's Badge and QR Code attachments. The new files are
 * uploaded first and the old ones dropped after, so a record never sits empty.
 */
export async function writeBadge(
  env: Env,
  recordId: string,
  files: { badge: { name: string; png: Uint8Array }; qr: { name: string; png: Uint8Array } },
): Promise<void> {
  const badgeId = await uploadPng(env, recordId, R.fields.badge, files.badge.name, files.badge.png);
  const qrId = await uploadPng(env, recordId, R.fields.qrCode, files.qr.name, files.qr.png);
  await airtableRequest(env, `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${R.table}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { [R.fields.badge]: [{ id: badgeId }], [R.fields.qrCode]: [{ id: qrId }] } }),
  });
}
