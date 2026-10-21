import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '@fontsource/space-mono/400.css';
import '../index.css';
import { QR_CLIP, QR_SIZE, isBadgeType, type BadgeData } from '../../shared/badges';
import { BadgeCard, BadgeQr } from './BadgeCard';
import { loadBadgeFonts } from './fitText';

declare global {
  interface Window {
    /** One badge (PDF page 1) plus its QR (screenshotted at QR_CLIP, hidden when printing). */
    renderBadge?: (data: BadgeData) => Promise<void>;
    /** Several badges, one per printed page — a batch PDF. */
    renderBadgeSheet?: (list: BadgeData[]) => Promise<void>;
  }
}

const root = createRoot(document.getElementById('root')!);

async function show(content: ReactNode) {
  await loadBadgeFonts();
  flushSync(() => root.render(content));
  await Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** Called by the Worker for each badge; resolves once the page is ready to capture. */
window.renderBadge = (data) =>
  show(
    <>
      <BadgeCard data={data} />
      <div data-screen-only className="absolute" style={{ left: QR_CLIP.x, top: QR_CLIP.y }}>
        <BadgeQr value={data.qrLink} size={QR_SIZE} />
      </div>
    </>,
  );

window.renderBadgeSheet = (list) =>
  show(
    list.map((data, i) => (
      <div key={i} className="badge-page">
        <BadgeCard data={data} />
      </div>
    )),
  );

// Design check without real data: badge-render.html#sample=Sponsor%20Expo
const sample = new URLSearchParams(location.hash.slice(1)).get('sample');
if (sample && isBadgeType(sample)) {
  void window.renderBadge({
    firstName: 'Firstname',
    lastName: 'Lastname',
    company: 'Company Name',
    qrLink: 'https://ip.bizzabo.com/events/828839/attendees/0',
    type: sample,
  });
}
