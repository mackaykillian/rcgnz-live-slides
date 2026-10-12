import type { Speaker } from '../../../shared/types';
import bgSunset from '../../assets/slides/headshot-bg-sunset.png';
import bgAqua from '../../assets/slides/headshot-bg-aqua.png';

export type HeadshotTheme = 'sunset' | 'aqua';

/** Sunset, Aqua, Sunset, Aqua… left to right, matching the Figma lineups. */
export const themeForIndex = (index: number): HeadshotTheme => (index % 2 === 0 ? 'sunset' : 'aqua');

interface Props {
  speaker: Speaker;
  theme: HeadshotTheme;
  size: number;
}

/**
 * Figma "Stylized Headshot". Uses the pre-composed Sunset/Aqua image from
 * Airtable when present; otherwise places the transparent cut-out over the
 * matching themed glass-wall background.
 */
export function StylizedHeadshot({ speaker, theme, size }: Props) {
  const composed = speaker.headshots[theme];
  const cutout = speaker.headshots.transparent;

  return (
    <div className="relative shrink-0 overflow-hidden bg-[#020e1e]" style={{ width: size, height: size }}>
      {composed ? (
        <img src={composed.url} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <img src={theme === 'sunset' ? bgSunset : bgAqua} alt="" className="absolute inset-0 size-full" />
          {cutout ? (
            // Airtable cut-outs are 1080×1080, framed to match the Sunset/Aqua backgrounds.
            <img src={cutout.url} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span
              className="absolute inset-0 flex items-center justify-center font-crystal font-semibold text-white/40"
              style={{ fontSize: size * 0.3 }}
            >
              {initials(speaker.name)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
