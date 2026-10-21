import puppeteer, { type Browser } from '@cloudflare/puppeteer';
import { BADGE_CLIP, BADGE_DPI, BADGE_SCALE, QR_CLIP, type BadgeData } from '../../shared/badges';
import { setPngDpi } from './png';

export interface RenderedBadge {
  badge: Uint8Array;
  qr: Uint8Array;
}

export type RenderBadge = (data: BadgeData) => Promise<RenderedBadge>;

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
 * Render badges in Cloudflare's headless browser. It loads this app's
 * badge-render.html — the same React template as the admin preview — and
 * screenshots the badge and its QR at 300 DPI.
 *
 * `origin` must be reachable by the browser: the deployed app in production,
 * the dev server locally (local Browser Rendering runs Chrome on this machine).
 */
export async function withBadgeRenderer<T>(env: Env, origin: string, task: (render: RenderBadge) => Promise<T>): Promise<T> {
  const browser = await openBrowser(env);
  try {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 600, height: 480, deviceScaleFactor: BADGE_SCALE });
      await page.goto(new URL('/badge-render.html', origin).href, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => typeof (globalThis as { renderBadge?: unknown }).renderBadge === 'function');

      return await task(async (data) => {
        await page.evaluate(
          (d) => (globalThis as unknown as { renderBadge: (d: BadgeData) => Promise<void> }).renderBadge(d),
          data,
        );
        const badge = await page.screenshot({ type: 'png', clip: BADGE_CLIP, encoding: 'binary' });
        const qr = await page.screenshot({ type: 'png', clip: QR_CLIP, encoding: 'binary' });
        return {
          badge: setPngDpi(new Uint8Array(badge), BADGE_DPI),
          qr: setPngDpi(new Uint8Array(qr), BADGE_DPI),
        };
      });
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    // Disconnect rather than close: the session idles for KEEP_ALIVE_MS for the next batch.
    await browser.disconnect();
  }
}
