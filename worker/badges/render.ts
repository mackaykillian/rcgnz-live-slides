import puppeteer, { type Browser, type Page } from '@cloudflare/puppeteer';
import { BADGE_DPI, BADGE_SCALE, QR_CLIP, type BadgeData } from '../../shared/badges';
import { setPngDpi } from './png';

export interface RenderedBadge {
  /** One-page print PDF: trim + bleed with crop marks, vector text and QR. */
  pdf: Uint8Array;
  /** Standalone QR PNG at 300 DPI. */
  qr: Uint8Array;
}

export interface BadgeRenderer {
  badge: (data: BadgeData) => Promise<RenderedBadge>;
  /** Many badges as one PDF, a page each (a printer batch). */
  sheet: (list: BadgeData[]) => Promise<Uint8Array>;
}

/** Idle browsers stay open this long, so back-to-back batches skip the browser launch. */
const KEEP_ALIVE_MS = 120_000;

/** Reuse an idle browser session if there is one; otherwise start a new one. */
async function openBrowser(env: Env): Promise<Browser> {
  const idle = (await puppeteer.sessions(env.BROWSER).catch(() => [])).find((s) => !s.connectionId);
  if (idle) {
    try {
      return await puppeteer.connect(env.BROWSER, idle.sessionId);
    } catch {
      // Taken or closed in the meantime — launch a fresh one.
    }
  }
  return puppeteer.launch(env.BROWSER, { keep_alive: KEEP_ALIVE_MS });
}

/**
 * The badge is laid out 1 CSS px = 1 pt (as in Figma), but Chrome prints 96 CSS
 * px per inch, so print at scale 4/3. The page is the @page size in
 * badge-render.html — exactly the Figma frame in points (BADGE_WIDTH × BADGE_HEIGHT).
 */
const printPdf = async (page: Page, pageRanges?: string) =>
  new Uint8Array(
    await page.pdf({
      // Page size comes from badge-render.html's @page rule; width/height options get rounded by Chrome.
      preferCSSPageSize: true,
      scale: 96 / 72,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      printBackground: true,
      pageRanges,
    }),
  );

type RenderWindow = {
  renderBadge: (data: BadgeData) => Promise<void>;
  renderBadgeSheet: (list: BadgeData[]) => Promise<void>;
};

/**
 * Render badges in Cloudflare's headless browser. It loads this app's
 * badge-render.html — the same React template as the admin preview.
 *
 * `origin` must be reachable by the browser: the deployed app in production,
 * the dev server locally (local Browser Rendering runs Chrome on this machine).
 */
export async function withBadgeRenderer<T>(env: Env, origin: string, task: (render: BadgeRenderer) => Promise<T>): Promise<T> {
  const browser = await openBrowser(env);
  try {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 600, height: 480, deviceScaleFactor: BADGE_SCALE });
      await page.goto(new URL('/badge-render.html', origin).href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => typeof (globalThis as { renderBadgeSheet?: unknown }).renderBadgeSheet === 'function');

      return await task({
        badge: async (data) => {
          await page.evaluate((d) => (globalThis as unknown as RenderWindow).renderBadge(d), data);
          const qr = await page.screenshot({ type: 'png', clip: QR_CLIP, encoding: 'binary' });
          return { pdf: await printPdf(page, '1'), qr: setPngDpi(new Uint8Array(qr), BADGE_DPI) };
        },
        sheet: async (list) => {
          await page.evaluate((l) => (globalThis as unknown as RenderWindow).renderBadgeSheet(l), list);
          return printPdf(page);
        },
      });
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    // Disconnect rather than close: the session idles for KEEP_ALIVE_MS for the next batch.
    await browser.disconnect();
  }
}
