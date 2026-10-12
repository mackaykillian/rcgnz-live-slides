import type { Speaker } from '../../../shared/types';
import { StylizedHeadshot, themeForIndex } from './StylizedHeadshot';

/** Card + type sizes from the Figma "Speaker Slides" variants (1–3 vs 4–5 speakers). */
const LARGE = { card: 353.365, name: 32, title: 24, company: 18, tracking: 0.9615, lineGap: 9.615 };
const SMALL = { card: 294, name: 24, title: 18, company: 16, tracking: 0.8, lineGap: 8 };

export function SpeakerLineup({ speakers }: { speakers: Speaker[] }) {
  if (speakers.length === 0) return null;
  const s = speakers.length >= 4 ? SMALL : LARGE;
  const solo = speakers.length === 1;

  return (
    <div className="flex items-start justify-center gap-[32px]">
      {speakers.map((speaker, i) => (
        <div
          key={speaker.id}
          className={`flex shrink-0 flex-col ${solo ? 'items-center gap-[19.231px] text-center' : 'items-start gap-[16px]'}`}
          style={{ width: s.card }}
        >
          <StylizedHeadshot speaker={speaker} theme={themeForIndex(i)} size={s.card} />
          <div
            className="flex w-full flex-col font-crystal leading-[1.2] text-white"
            style={{ letterSpacing: s.tracking, gap: s.lineGap }}
          >
            <p className="font-semibold" style={{ fontSize: s.name }}>
              {speaker.name}
            </p>
            {speaker.jobTitle && (
              <p className="font-normal" style={{ fontSize: s.title }}>
                {speaker.jobTitle}
              </p>
            )}
            {speaker.company && (
              <p className="font-medium" style={{ fontSize: s.company }}>
                {speaker.company}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
