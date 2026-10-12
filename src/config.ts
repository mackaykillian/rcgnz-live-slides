/** App-wide constants. Event switching is a future feature — for now there's one event. */

export const EVENT_NAME = 'RCGNZ Summit 2026';

/** All session times are shown in the venue's time zone, regardless of the viewer's. */
export const EVENT_TIME_ZONE = 'America/Denver';

/** Options for the Day filter (YYYY-MM-DD in EVENT_TIME_ZONE). */
export const EVENT_DAYS = ['2026-11-09', '2026-11-10', '2026-11-11'];

/** Placeholder QR destination on the SHRM slide until Airtable provides one. */
export const SHRM_QR_URL = 'https://awardco.com/rcgnz';

export const LINKS = {
  airtable:
    'https://airtable.com/invite/l?inviteId=invPP5tbRiQTek5nH&inviteToken=6231a847dca433298ddef17e287db6aecde581826da90123d3bc0a3378b68e5d&utm_medium=email&utm_source=product_team&utm_content=transactional-alerts',
  figma:
    'https://www.figma.com/design/KAdmZm4X32rnihx6KROAzp/RCGNZ-Summit-2026-Marketing-Requests?node-id=2178-14',
};

/** How often the open app re-reads the latest synced snapshot from the Worker. */
export const SNAPSHOT_REFRESH_MS = 2 * 60 * 1000;
