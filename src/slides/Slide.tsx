import { SHRM_QR_URL } from '../config';
import type { SlideItem } from './templates';
import { HoldingSlide } from './templates/HoldingSlide';
import { ShrmSlide } from './templates/ShrmSlide';
import { SpeakerSlide } from './templates/SpeakerSlide';

/** Render a slide instance at its native 1920×1080. Wrap in <SlideFrame> to scale. */
export function Slide({ item }: { item: SlideItem }) {
  switch (item.template) {
    case 'upcoming':
    case 'standard':
      return <SpeakerSlide variant={item.template} title={item.title} speakers={item.speakers} />;
    case 'shrm':
      return <ShrmSlide speakers={item.speakers} shrmCode={item.session?.shrmCode ?? null} qrUrl={SHRM_QR_URL} />;
    case 'holding':
      return <HoldingSlide />;
  }
}
