import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '@fontsource/space-mono/400.css';
import '../index.css';
import { BADGE_CLIP, QR_CLIP, QR_SIZE, isBadgeType, type BadgeData } from '../../shared/badges';
import { BadgeCard, BadgeQr } from './BadgeCard';
import { loadBadgeFonts } from './fitText';

declare global {
  interface Window {
    renderBadge?: (data: BadgeData) => Promise<void>;
  }
}

const root = createRoot(document.getElementById('root')!);

/** Called by the Worker for each badge; resolves once the page is ready to screenshot. */
window.renderBadge = async (data) => {
  await loadBadgeFonts();
  flushSync(() =>
    root.render(
      <>
        <div className="absolute" style={{ left: BADGE_CLIP.x, top: BADGE_CLIP.y }}>
          <BadgeCard data={data} />
        </div>
        <div className="absolute" style={{ left: QR_CLIP.x, top: QR_CLIP.y }}>
          <BadgeQr value={data.qrLink} size={QR_SIZE} />
        </div>
      </>,
    ),
  );
  await Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

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
