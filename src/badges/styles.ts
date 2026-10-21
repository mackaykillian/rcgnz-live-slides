import { Handshake, MicrophoneStage, type Icon } from '@phosphor-icons/react';
import type { BadgeType } from '../../shared/badges';
import bgAttendee from '../assets/badges/bg-attendee.png';
import bgAwardcoCustomer from '../assets/badges/bg-awardco-customer.png';
import bgEmployee from '../assets/badges/bg-employee.png';
import bgSponsor from '../assets/badges/bg-sponsor.png';

export interface BadgeStyle {
  /** Tag text (rendered uppercase). */
  label: string;
  icon?: Icon;
  /** Tag fill, QR frame and QR shadow. */
  accent: string;
  /** Tag text/icon color. */
  onAccent: string;
  /** Pre-rendered glow background (replaces Figma's blurred "Glassy Grid"). */
  background: string;
}

const WHITE = '#fbfbfb';
const BLACK = '#020e1e';
const BLUE = '#256cfa';
const GRAPEFRUIT = '#fc835e';
const GREEN = '#a8f39b';

/** Figma "Badge Designs" (node 12525-24140) — one frame per badge type. */
export const BADGE_STYLES: Record<BadgeType, BadgeStyle> = {
  Employee: { label: 'Employee', accent: BLUE, onAccent: WHITE, background: bgEmployee },
  Sponsor: { label: 'Sponsor', icon: Handshake, accent: GRAPEFRUIT, onAccent: WHITE, background: bgSponsor },
  'Sponsor Expo': { label: 'Expo Sponsor', accent: GRAPEFRUIT, onAccent: WHITE, background: bgSponsor },
  'Awardco Customer': { label: 'Awardco Customer', accent: GREEN, onAccent: BLACK, background: bgAwardcoCustomer },
  'Awardco Customer Speaker': {
    label: 'Awardco Customer',
    icon: MicrophoneStage,
    accent: GREEN,
    onAccent: BLACK,
    background: bgAwardcoCustomer,
  },
  Attendee: { label: 'Attendee', accent: BLACK, onAccent: WHITE, background: bgAttendee },
  'Attendee Speaker': { label: 'Attendee', icon: MicrophoneStage, accent: BLACK, onAccent: WHITE, background: bgAttendee },
};
