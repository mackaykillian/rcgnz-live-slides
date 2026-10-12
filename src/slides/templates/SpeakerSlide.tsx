import type { Speaker } from '../../../shared/types';
import clockClockwise from '../../assets/slides/clock-clockwise.svg';
import { MonoLabel, SessionTitle, SlideCanvas, SlideLogo } from '../parts/common';
import { SpeakerLineup } from '../parts/SpeakerLineup';

export interface SpeakerSlideProps {
  /** `upcoming` adds the "Upcoming session" tag; `standard` centers the content vertically. */
  variant: 'upcoming' | 'standard';
  title: string;
  speakers: Speaker[];
}

/** Figma: Speaker Slides › Upcoming Session / Standard (1–5 speakers). */
export function SpeakerSlide({ variant, title, speakers }: SpeakerSlideProps) {
  const content = (
    <div className="flex flex-col items-center gap-[40px]">
      <SessionTitle>{title}</SessionTitle>
      <SpeakerLineup speakers={speakers} />
    </div>
  );

  return (
    <SlideCanvas>
      {variant === 'upcoming' ? (
        <>
          <div className="absolute top-[108px] left-1/2 flex -translate-x-1/2 items-center justify-center gap-[16px] bg-white/10 px-[30px] py-[20px]">
            <img src={clockClockwise} alt="" className="size-[40px]" />
            <MonoLabel>Upcoming session</MonoLabel>
          </div>
          <div className="absolute inset-x-0 top-[272px] flex justify-center">{content}</div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">{content}</div>
      )}
      <SlideLogo />
    </SlideCanvas>
  );
}
