/**
 * Airtable table + field names. This is the ONLY place that knows how the
 * Airtable base is laid out — if someone renames a field in Airtable, update it
 * here. Run `npm run airtable:schema` to print the base's real tables/fields.
 *
 * Tables are referenced by id (tblXXXX) so renaming a table doesn't break sync.
 */
export const AIRTABLE = {
  sessions: {
    table: 'tblOOkAIf7PEjRVhd', // Sessions
    fields: {
      title: 'Title',
      start: 'Start Date Time',
      end: 'End Date Time',
      /** Lookup of tag names via "Tags Ref". */
      tags: 'Tags Names',
      shrmCode: 'SHRM Code',
      /** Linked records → Speakers, in presentation order. */
      speakers: 'Speakers Ref',
      /** Single select — matched against EVENT_NAME. */
      event: 'Event Name',
      /**
       * Where the session is held. Synced from Bizzabo ("Location"); this replaced
       * the hand-entered "Room" select. Drives room filters, slideshow decks and
       * the Agenda Timeline columns.
       */
      room: 'Location' as string | null,
      /** Checkbox — whether the session takes registrations. */
      registration: 'Session Registration',
      /** Numbers (may be blank). */
      registrationCount: 'Session Registration Count',
      registrationCapacity: 'Session Registration Capacity',
    },
  },
  speakers: {
    table: 'tblfd9DUetOtqXyLq', // Speakers
    fields: {
      name: 'Full Name',
      jobTitle: 'Title',
      company: 'Company',
      /** Linked record → Headshots. */
      headshot: 'Headshots Ref',
    },
  },
  headshots: {
    table: 'tblMRGx7fBP21iZJ8', // Headshots
    fields: {
      transparent: 'Headshot (Transparent)',
      sunset: 'Headshot (2026 Sunset)',
      aqua: 'Headshot (2026 Aqua)',
    },
  },
} as const;
