import { QRCodeSVG } from 'qrcode.react';
import type { Speaker } from '../../../shared/types';
import shrmLogo from '../../assets/slides/shrm-logo.png';
import { MonoLabel, SessionTitle, SlideCanvas, SlideLogo } from '../parts/common';
import { SpeakerLineup } from '../parts/SpeakerLineup';

export interface ShrmSlideProps {
  speakers: Speaker[];
  shrmCode: string | null;
  qrUrl: string;
}

/**
 * Figma: Speaker Slides › SHRM Code (1–5 speakers). With 1–2 speakers the code
 * sits above the lineup; with 3+ it moves to the bottom to make room.
 */
export function ShrmSlide({ speakers, shrmCode, qrUrl }: ShrmSlideProps) {
  const codeOnTop = speakers.length <= 2;

  const content = (
    <div className="flex flex-col items-center gap-[40px]">
      <SessionTitle>Take a moment to recognize the speaker{speakers.length === 1 ? '' : 's'}</SessionTitle>
      <SpeakerLineup speakers={speakers} />
    </div>
  );

  const codeBox = (position: string) => (
    <div className={`absolute left-1/2 ${position} flex h-[168px] w-[502px] -translate-x-1/2 flex-col items-center justify-center gap-[10px] bg-white/10`}>
      <div className="flex items-center gap-[22px]">
        <img src={shrmLogo} alt="SHRM" className="h-[40px] w-auto" />
        <MonoLabel>Code</MonoLabel>
      </div>
      <p
        className={`font-space-mono leading-[1.15] font-bold tracking-[0.02em] whitespace-nowrap ${shrmCode ? 'text-[72px] text-[#256cfa]' : 'text-[40px] text-white/40'}`}
      >
        {shrmCode ?? 'CODE PENDING'}
      </p>
    </div>
  );

  return (
    <SlideCanvas>
      {codeOnTop ? (
        <>
          {codeBox('top-[108px]')}
          <div className="absolute inset-x-0 top-[276px] bottom-[44px] flex items-center justify-center">{content}</div>
        </>
      ) : (
        <>
          <div className="absolute inset-x-0 top-[108px] flex justify-center">{content}</div>
          {codeBox('bottom-[108px]')}
        </>
      )}
      <div className="absolute top-[904px] left-[40px] size-[136px] bg-white p-[9.52px]">
        <QRCodeSVG value={qrUrl} size={117} marginSize={0} bgColor="#ffffff" fgColor="#000000" />
      </div>
      <SlideLogo />
    </SlideCanvas>
  );
}
