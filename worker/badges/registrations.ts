import {
  BADGE_TEMPLATE_VERSION,
  isBadgeType,
  type BadgeData,
  type BadgeRegistration,
} from '../../shared/badges';
import { listAllRecords, type AirtableRecord } from '../airtable/client';
import { AIRTABLE } from '../airtable/fieldMap';
import { asAttachment, asNumber, asText } from '../airtable/normalize';

const R = AIRTABLE.registrations;

/** A Registrations record, reduced to what badges need. */
export interface RegistrationRow {
  recordId: string;
  registrationId: number | null;
  data: BadgeData | null;
  invalidReason?: string;
  hasBadge: boolean;
  hasQr: boolean;
}

export function toRegistrationRow(rec: AirtableRecord): RegistrationRow {
  const f = rec.fields;
  const firstName = asText(f[R.fields.preferredName]) ?? asText(f[R.fields.firstName]) ?? '';
  const lastName = asText(f[R.fields.lastName]) ?? '';
  const qrLink = asText(f[R.fields.qrLink]);
  const type = asText(f[R.fields.badgeType]);

  let invalidReason: string | undefined;
  if (!type) invalidReason = 'No Badge Type';
  else if (!isBadgeType(type)) invalidReason = `Unknown Badge Type "${type}"`;
  else if (!qrLink) invalidReason = 'No QR Code Link';
  else if (!firstName && !lastName) invalidReason = 'No name';

  return {
    recordId: rec.id,
    registrationId: asNumber(f[R.fields.registrationId]),
    data:
      invalidReason || !isBadgeType(type) || !qrLink
        ? null
        : { firstName, lastName, company: asText(f[R.fields.company]) ?? '', qrLink, type },
    invalidReason,
    hasBadge: !!asAttachment(f[R.fields.badge]),
    hasQr: !!asAttachment(f[R.fields.qrCode]),
  };
}

/** Changes whenever anything printed on the badge — or the template — changes. */
export async function badgeFingerprint(data: BadgeData): Promise<string> {
  const input = JSON.stringify([BADGE_TEMPLATE_VERSION, data.type, data.firstName, data.lastName, data.company, data.qrLink]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** recordId → fingerprint of the badge last uploaded for it. */
export type Fingerprints = Record<string, string>;

const FINGERPRINTS_KEY = 'badges/fingerprints.json';

export async function readFingerprints(env: Env): Promise<Fingerprints> {
  return (await env.STORE.get<Fingerprints>(FINGERPRINTS_KEY, 'json')) ?? {};
}

/** Merge into the latest stored map (another run may have written meanwhile). */
export async function saveFingerprints(env: Env, updates: Fingerprints): Promise<void> {
  if (!Object.keys(updates).length) return;
  const latest = await readFingerprints(env);
  await env.STORE.put(FINGERPRINTS_KEY, JSON.stringify({ ...latest, ...updates }));
}

export async function badgeStatus(
  row: RegistrationRow,
  fingerprints: Fingerprints,
): Promise<Pick<BadgeRegistration, 'status' | 'reason'>> {
  if (!row.data) return { status: 'invalid', reason: row.invalidReason };
  if (!row.hasBadge) return { status: 'pending', reason: 'No badge yet' };
  if (!row.hasQr) return { status: 'pending', reason: 'No QR code yet' };
  if (fingerprints[row.recordId] !== (await badgeFingerprint(row.data))) {
    return { status: 'pending', reason: 'Details or template changed' };
  }
  return { status: 'current' };
}

const REGISTRATION_FIELDS = Object.values(R.fields);

/** All registrations, or just `recordIds`. */
export async function readRegistrations(env: Env, recordIds?: string[]): Promise<RegistrationRow[]> {
  const filterByFormula = recordIds?.length
    ? `OR(${recordIds.map((id) => `RECORD_ID()='${id.replace(/[^\w]/g, '')}'`).join(',')})`
    : undefined;
  const records = await listAllRecords(env.AIRTABLE_TOKEN, env.AIRTABLE_BASE_ID, R.table, {
    fields: REGISTRATION_FIELDS,
    filterByFormula,
  });
  return records.map(toRegistrationRow);
}

export async function listBadgeRegistrations(env: Env): Promise<BadgeRegistration[]> {
  const [rows, fingerprints] = await Promise.all([readRegistrations(env), readFingerprints(env)]);
  return Promise.all(
    rows.map(async (row) => ({
      recordId: row.recordId,
      registrationId: row.registrationId,
      data: row.data,
      ...(await badgeStatus(row, fingerprints)),
    })),
  );
}
