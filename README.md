# RCGNZ Live Slides

Generates the RCGNZ Summit 2026 session slides from Airtable, using React
templates built from the Figma designs. You can browse every slide, open a
large preview, copy it as a PNG, or download one or many as 4K (3840×2160) PNGs.

Built with **Vite + React 19 + TypeScript + Tailwind v4**. It deploys as one
**Cloudflare Worker**: the Worker serves the app, holds the Airtable token, runs
the scheduled sync, and caches data and headshots in **Workers KV**.

## Getting started

```bash
cp ~/Library/Fonts/{Crystal-Regular,Crystal-Medium,Crystal-SemiBold,Emilio-RegularItalic}.otf public/fonts/
cp .dev.vars.example .dev.vars   # then paste your Airtable token (or leave empty for sample data)
npm install
npm run dev                      # http://localhost:5173
```

When `.dev.vars` has no token, the app runs on **sample data**: 47 real 2026
sessions taken from the signage project's mock data. The sidebar shows
"sample data" next to the sync time.

### Airtable token

1. Create a personal access token at <https://airtable.com/create/tokens>.
   - Scopes: `data.records:read`, `data.records:write` (badges) and `schema.bases:read`.
   - Access: only the RCGNZ base (`appFtt4DomwAITJTa`).
2. Paste it into `.dev.vars` as `AIRTABLE_TOKEN=pat…`. The file is gitignored.
3. Run `npm run airtable:schema` to print the base's real tables and fields.
4. Update [`worker/airtable/fieldMap.ts`](worker/airtable/fieldMap.ts) to match.
   It's the only file that knows Airtable field names.

The token is only ever read by the Worker. It never reaches the browser. The
only thing the app writes is the Registrations table's **Badge** and **QR Code**
attachments (see Badges below).

## How it works

```
Airtable ──(cron every 15 min / Sync button)──▶ Worker ──▶ KV: snapshot.json
                                                   │
Browser ◀── /api/snapshot ─────────────────────────┤
Browser ◀── /api/images/:id ◀── KV cache ◀── Airtable attachment URL (fetched once)
```

- **Sync** ([`worker/sync.ts`](worker/sync.ts)). The sync:
  - reads Sessions filtered to `EVENT_NAME`, plus Speakers and Headshots
  - joins them and normalizes them into [`shared/types.ts`](shared/types.ts)
  - stores the result as one snapshot

  Manual syncs within 15 seconds of each other reuse the last result.
- **Images**. Airtable attachment URLs expire after about 2 hours, so the
  snapshot points at `/api/images/<attachmentId>`. On first request, the Worker
  copies the image into KV and serves it from there afterward. It's same-origin,
  so PNG export works.
- **Slides** ([`src/slides`](src/slides)). Each template renders at a native
  1920×1080, matching Figma 1:1. `SlideFrame` scales it down for thumbnails and
  previews. Export ([`src/export/exportSlides.tsx`](src/export/exportSlides.tsx))
  mounts a fresh off-screen copy and captures it at 2× with `modern-screenshot`.
- **Slides per session**. Each template in
  [`src/slides/templates.ts`](src/slides/templates.ts) is either dynamic
  (`kind: 'speakers'`) or static. Every session **with at least one speaker**
  gets *Upcoming session*, *Standard* and *SHRM Code* slides; sessions without
  speakers are skipped. The static *Holding Slide* always appears once. Data gaps
  show as a ⚠ on the card: no SHRM code, more than 5 speakers, or no start time.
- **Headshots**. Speakers alternate Sunset, Aqua, Sunset… If the Sunset/Aqua
  image is missing, the transparent cut-out is placed over the matching themed
  background (`src/assets/slides/headshot-bg-*.png`).
- **Rooms** come from the Sessions table's **Location** field, which is synced
  from Bizzabo. It replaced the hand-entered "Room" select. Room names must
  match the names used in `src/slideshows/decks.ts` and `src/calendar/layout.ts`.
- **Slideshows** ([`src/slideshows`](src/slideshows)). Each room's deck is an
  ordered array of entries `{ key, slideId }`, built in two steps:
  1. A **ruleset** (`roomRuleset`) takes the room's sessions in start-time
     order. It lays out each session as Upcoming → Standard → SHRM, with the
     Holding slide before the first session, between sessions, and at the end.
     Templates, separator and placement are all options.
  2. Optional **overrides** in [`decks.ts`](src/slideshows/decks.ts) can
     `insert`, `remove` or `move` entries by key, for one-off manual edits.
     A future one-off slide is a new static template inserted this way.

  Slide ids are stable: `recXXXX:upcoming` for session slides, `static:holding`
  for static ones. Entry keys add context for repeats, such as
  `static:holding@before:recXXXX`, so overrides survive re-syncs.
  Present with **Enter fullscreen**:
  - ← / → (plus Space, PageUp/PageDown, Home/End) to move between slides
  - **Esc** or the top-right **Exit fullscreen** button to leave
- **Agenda Timeline View** ([`src/calendar`](src/calendar)) is a Google
  Calendar–style day view with one column per room, in event time:
  - Blocks are sized by start/end time and show the title, the time and speaker
    avatars.
  - Overlapping sessions in a room sit side by side.
  - Day tabs switch between Nov 9–11 (`#/calendar/2026-11-10`).
  - Column order, room label colors (`ROOM_LABEL_COLORS`), the double-width
    mainstage (`MAINSTAGE_ROOM`, Grand Ballroom) and the
    scale are set in `src/calendar/layout.ts`.
  - Awardco HQ, Montage Entrance and sessions without a location are hidden
    (`HIDDEN_CALENDAR_ROOMS`). A warning above the timeline lists any sessions
    missing a location.
  - **Registration tag** (bottom-right of a session) shows registered/capacity
    and Open / Low (under 25% of seats left) / Full. It only appears when
    "Session Registration" is checked and there's a capacity. A blank count
    is treated as 0.
  - **Current time:** a green line marks it, and sessions that have ended are
    dimmed to 50%. **Live** follows the clock; picking a time in the
    15-minute picker pins it instead (manual mode, applies to the day shown).
  - **Fullscreen** expands this same view over the whole screen (sidebar
    hidden). Day tabs, scrolling and the time controls keep working. Click
    **Exit fullscreen** or press Esc to return.
- **File names**. `MMDDYYYY_HHmm_SessionTitle_Template.png`, in event time
  (America/Denver). Batch downloads come as a zip.

## Changing things

| To change… | Edit |
| --- | --- |
| A slide's design | `src/slides/templates/*` and `src/slides/parts/*` |
| Airtable field names | `worker/airtable/fieldMap.ts` |
| Sync frequency | `triggers.crons` in `wrangler.jsonc` (e.g. `*/5 * * * *` during the event) |
| QR code target, event days, links | `src/config.ts` |
| Which slideshows exist, their order and manual edits | `src/slideshows/decks.ts` |
| How slideshows are ordered (rulesets) | `src/slideshows/deck.ts` |

## Deploy (Cloudflare)

```bash
npx wrangler login
npx wrangler secret put AIRTABLE_TOKEN
npm run deploy                     # builds, then `wrangler deploy`
```

> The sync uses little CPU, but the Workers **Paid** plan is the safe choice:
> the free plan caps CPU at 10 ms per request.

## Admin: Fetch Bizzabo

The sidebar's **Admin only → Fetch Bizzabo** runs the separate
`airtable-bizzabo-sync` worker (Bizzabo → Airtable) on demand. After that, it
re-syncs this app from Airtable. It goes through `POST /api/admin/bizzabo-fetch`,
which requires the admin passcode. The browser asks for it once and remembers it.
The app reaches the Bizzabo worker through a **service binding** (`BIZZABO_SYNC`
in `wrangler.jsonc`), not its public URL. Cloudflare blocks one Worker from
fetching another's `workers.dev` URL on the same account (error 1042, which
shows up as a 404). In `npm run dev` the Bizzabo worker isn't running, so this
action reports that it can't be reached. Test it on the deployed app.

Secrets (`npx wrangler secret put <NAME>`; locally in `.dev.vars`):

| Worker | Secret | |
| --- | --- | --- |
| rcgnz-live-slides | `ADMIN_PASSCODE` | Passcode admins type in the app |
| rcgnz-live-slides | `BIZZABO_SYNC_SECRET` | Same value as below |
| airtable-bizzabo-sync | `MANUAL_SYNC_SECRET` | Enables its `POST /` manual trigger |

## Admin: Badges

Print badges for every registration in the Airtable **Registrations** table
(synced from Bizzabo). Each badge is a PNG at 300 DPI: 3.5″ × 5.5″ trim plus
bleed with crop marks, 1113 × 1725 px. It's saved to the record's **Badge**
field, with a standalone QR PNG (2″, 600 px) in **QR Code**. The QR encodes the
record's *QR Code Link* (the Bizzabo attendee URL), the same as Bizzabo's own tickets.

- **Template:** [`src/badges/BadgeCard.tsx`](src/badges/BadgeCard.tsx), with one style per
  *Badge Type* in [`styles.ts`](src/badges/styles.ts). The Figma frames are in
  "Badge Designs" (node 12525-24140). The blurred glow backgrounds are
  pre-rendered PNGs (`src/assets/badges/bg-*.png`). *Preferred Name* replaces
  *First Name*. Long names shrink to fit, and companies wrap to two lines and then shrink.
- **Rendering:** the Worker opens [`badge-render.html`](badge-render.html) in
  Cloudflare Browser Rendering (the `BROWSER` binding) and screenshots the same
  React template ([`worker/badges/render.ts`](worker/badges/render.ts)). Locally, `npm run dev`
  runs this in a local headless Chrome. Open `/badge-render.html#sample=Sponsor`
  to see any type with placeholder data.
- **When badges are made:** a badge is *pending* when Badge or QR Code is empty,
  or when the name, company, type or QR link changed since it was made. Changes
  are tracked by a fingerprint in KV. Every 15 minutes the cron generates up to
  25 pending badges. **Bump `BADGE_TEMPLATE_VERSION`** in
  [`shared/badges.ts`](shared/badges.ts) after changing the template, so every
  badge regenerates.
- **Admin page:** go to **Admin only → Badges** (`#/badges`, passcode required). It shows
  every registration rendered live, with its status. *Generate pending* and
  *Regenerate all* run in batches of 10. Each card has **Generate/Regenerate**
  and **Preview PNG**, which renders the print file without uploading it.
  Deleting a record's Badge in Airtable also queues it for the next cron run.

## Scripts

| Script | |
| --- | --- |
| `npm run dev` | App + Worker locally (workerd, local KV) |
| `npm run build` | Typecheck + production build |
| `npm test` | Vitest: filtering/sorting, file names, Airtable normalization |
| `npm run airtable:schema` | Print the Airtable base's tables and fields |
| `npm run cf-typegen` | Regenerate `worker/worker-configuration.d.ts` after editing `wrangler.jsonc` |
