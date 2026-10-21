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

export interface BadgeFile {
  name: string;
  contentType: 'application/pdf' | 'image/png';
  bytes: Uint8Array;
}

/** Upload a file into an attachment field (appends). Returns the new attachment's id. */
async function uploadFile(env: Env, recordId: string, field: string, file: BadgeFile): Promise<string> {
  const url = `https://content.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${recordId}/${encodeURIComponent(field)}/uploadAttachment`;
  const body = (await airtableRequest(env, url, {
    method: 'POST',
    body: JSON.stringify({ contentType: file.contentType, filename: file.name, file: toBase64(file.bytes) }),
  })) as UploadResponse;
  // The response lists the field's attachments (keyed by field id); the upload is appended last.
  const attachments = Object.values(body.fields)[0] ?? [];
  const added = attachments[attachments.length - 1];
  if (!added) throw new Error(`Upload to "${field}" returned no attachment`);
  return added.id;
}

/**
 * Replace the record's Badge and QR Code attachments and stamp "Badge Generated
 * At". The new files are uploaded first and the old ones dropped after, so a
 * record never sits empty. Returns the timestamp written.
 */
export async function writeBadge(
  env: Env,
  recordId: string,
  files: { badge: BadgeFile; qr: BadgeFile },
): Promise<string> {
  const generatedAt = new Date().toISOString();
  const badgeId = await uploadFile(env, recordId, R.fields.badge, files.badge);
  const qrId = await uploadFile(env, recordId, R.fields.qrCode, files.qr);
  await airtableRequest(env, `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${R.table}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: { [R.fields.badge]: [{ id: badgeId }], [R.fields.qrCode]: [{ id: qrId }], [R.fields.generatedAt]: generatedAt },
    }),
  });
  return generatedAt;
}
