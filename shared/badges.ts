/**
 * Badge contract shared by the Worker (reads Registrations, renders + uploads)
 * and the React badge template / admin page.
 */

/** Values of the Registrations "Badge Type" formula — one Figma design each. */
export const BADGE_TYPES = [
  'Awardco Customer',
  'Awardco Customer Speaker',
  'Sponsor',
  'Sponsor Expo',
  'Attendee',
  'Attendee Speaker',
  'Employee',
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];

export const isBadgeType = (value: unknown): value is BadgeType =>
  typeof value === 'string' && (BADGE_TYPES as readonly string[]).includes(value);

/**
 * Bump whenever the badge template changes visually. Every badge rendered with
 * an older version counts as out of date and is regenerated automatically.
 */
export const BADGE_TEMPLATE_VERSION = 3; // 2: PDF + LastName_FirstName_ID names; 3: no lanyard-slot marker

/**
 * Print geometry. The Figma frame is in points (1/72"): trim plus bleed, with
 * crop marks drawn in the bleed. The badge PDF page is exactly this size; the
 * QR PNG is rendered at 300 DPI.
 */
export const BADGE_WIDTH = 267.12;
export const BADGE_HEIGHT = 414;
export const BADGE_DPI = 300;
export const BADGE_SCALE = BADGE_DPI / 72;

/** Standalone QR PNG for the "QR Code" column: 2" square at 300 DPI. */
export const QR_SIZE = 144;

/** The printer takes at most this many badges per batch PDF. */
export const MAX_BADGES_PER_BATCH = 100;

/** Where the render page (badge-render.html) lays out the QR for the Worker to screenshot. */
export const QR_CLIP = { x: Math.ceil(BADGE_WIDTH) + 20, y: 0, width: QR_SIZE, height: QR_SIZE };

/** Everything printed on a badge. */
export interface BadgeData {
  /** Preferred Name when set, otherwise First Name. */
  firstName: string;
  lastName: string;
  company: string;
  /** Encoded in the QR — the attendee's Bizzabo check-in link. */
  qrLink: string;
  type: BadgeType;
}

/**
 * current — Badge + QR Code are in Airtable and match the latest data/template.
 * pending — missing, or the name/company/type/QR link/template changed since.
 * invalid — can't be generated (unknown Badge Type, no QR link, no name).
 */
export type BadgeStatus = 'current' | 'pending' | 'invalid';

export interface BadgeRegistration {
  recordId: string;
  registrationId: number | null;
  /** Airtable "Batch" (e.g. B1) — badges are sent to the printer one batch PDF at a time. */
  batch: string | null;
  /** ISO time the current Badge/QR Code were uploaded ("Badge Generated At"). */
  generatedAt: string | null;
  /** Null when invalid. */
  data: BadgeData | null;
  status: BadgeStatus;
  /** Why it's pending or invalid. */
  reason?: string;
}

export interface BadgesResponse {
  ok: boolean;
  registrations?: BadgeRegistration[];
  error?: string;
}

export interface BadgeResult {
  recordId: string;
  ok: boolean;
  /** Set when ok. */
  generatedAt?: string;
  error?: string;
}

export interface BadgeRunResponse {
  ok: boolean;
  results?: BadgeResult[];
  error?: string;
}
