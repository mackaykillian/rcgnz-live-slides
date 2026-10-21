import { describe, expect, it } from 'vitest';
import type { AirtableRecord } from '../airtable/client';
import { AIRTABLE } from '../airtable/fieldMap';
import { badgeFileNames } from './index';
import { setPngDpi, readPngDpi } from './png';
import { badgeFingerprint, badgeStatus, toRegistrationRow } from './registrations';

const F = AIRTABLE.registrations.fields;
const rec = (fields: Record<string, unknown>): AirtableRecord => ({ id: 'recA', createdTime: '', fields });
const base = {
  [F.registrationId]: 31614860,
  [F.firstName]: 'Aubrey',
  [F.lastName]: 'Vispisiano',
  [F.company]: 'Acme',
  [F.qrLink]: 'https://ip.bizzabo.com/events/828839/attendees/31614860',
  [F.badgeType]: 'Awardco Customer',
};

describe('toRegistrationRow', () => {
  it('prints the preferred name over the first name', () => {
    expect(toRegistrationRow(rec({ ...base, [F.preferredName]: 'Bree' })).data?.firstName).toBe('Bree');
    expect(toRegistrationRow(rec(base)).data?.firstName).toBe('Aubrey');
  });

  it('flags registrations that can’t get a badge', () => {
    expect(toRegistrationRow(rec({ ...base, [F.badgeType]: 'VIP' })).invalidReason).toBe('Unknown Badge Type "VIP"');
    expect(toRegistrationRow(rec({ ...base, [F.qrLink]: '' })).invalidReason).toBe('No QR Code Link');
    expect(toRegistrationRow(rec({ ...base, [F.badgeType]: undefined })).data).toBeNull();
  });

  it('reads the printer batch', () => {
    expect(toRegistrationRow(rec({ ...base, [F.batch]: 'B1' })).batch).toBe('B1');
    expect(toRegistrationRow(rec(base)).batch).toBeNull();
  });

  it('notices existing attachments', () => {
    const row = toRegistrationRow(rec({ ...base, [F.badge]: [{ id: 'att1', url: 'https://x' }] }));
    expect(row).toMatchObject({ hasBadge: true, hasQr: false });
  });
});

describe('badgeStatus', () => {
  it('is pending until both files exist and match the current details', async () => {
    const files = { [F.badge]: [{ id: 'a', url: 'u' }], [F.qrCode]: [{ id: 'b', url: 'u' }] };
    const row = toRegistrationRow(rec({ ...base, ...files }));
    const fp = await badgeFingerprint(row.data!);

    expect((await badgeStatus(toRegistrationRow(rec(base)), {})).status).toBe('pending');
    expect((await badgeStatus(row, {})).status).toBe('pending');
    expect((await badgeStatus(row, { recA: fp })).status).toBe('current');

    const renamed = toRegistrationRow(rec({ ...base, ...files, [F.company]: 'Acme Inc.' }));
    expect(await badgeStatus(renamed, { recA: fp })).toEqual({ status: 'pending', reason: 'Details or template changed' });
  });
});

describe('badgeFileNames', () => {
  it('is LastName_FirstName_RegistrationID, filename-safe', () => {
    const row = toRegistrationRow(rec({ ...base, [F.firstName]: 'José', [F.lastName]: "O'Neil-Smith" }));
    expect(badgeFileNames(row)).toEqual({
      badge: 'ONeilSmith_Jose_31614860.pdf',
      qr: 'ONeilSmith_Jose_31614860_QR.png',
    });
  });

  it('uses the printed (preferred) first name', () => {
    const row = toRegistrationRow(rec({ ...base, [F.preferredName]: 'Bree' }));
    expect(badgeFileNames(row).badge).toBe('Vispisiano_Bree_31614860.pdf');
  });
});

describe('setPngDpi', () => {
  // 1×1 transparent PNG.
  const png = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0),
  );

  it('stamps the print resolution after IHDR', () => {
    const out = setPngDpi(png, 300);
    expect(readPngDpi(png)).toBeNull();
    expect(readPngDpi(out)).toBe(300);
    expect(out.byteLength).toBe(png.byteLength + 21);
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs');
  });

  it('replaces an existing pHYs chunk', () => {
    const out = setPngDpi(setPngDpi(png, 72), 300);
    expect(readPngDpi(out)).toBe(300);
    expect(out.byteLength).toBe(png.byteLength + 21);
  });
});
