import holdingBackground from '../../assets/slides/holding-bg.webp';
import holdingLogo from '../../assets/slides/holding-logo.svg';
import heartBlue from '../../assets/slides/holding-heart-right.svg';
import heartGreen from '../../assets/slides/holding-heart-left.svg';
import { SlideCanvas } from '../parts/common';

/** Figma: Speaker Slides › Holding Slide. Static — no Airtable data. */
export function HoldingSlide() {
  return (
    <SlideCanvas>
      {/* Glows + glass grid, exported from Figma as one image. */}
      <img src={holdingBackground} alt="" className="absolute inset-0 size-full" />

      {/* Confetti */}
      <img
        src={heartBlue}
        alt=""
        className="absolute top-[calc(50%-71.97px)] left-[90.42%] w-[32px] -translate-y-1/2 -scale-x-100"
      />
      <img
        src={heartGreen}
        alt=""
        className="absolute top-[calc(50%-359.97px)] left-[27.29%] w-[32px] -translate-y-1/2 -scale-x-100"
      />
      <span className="absolute top-[885px] left-[calc(60%+158px)] size-[16px] bg-[#a8f39b]" />
      <span className="absolute top-[765px] left-[calc(40%+36px)] size-[16px] bg-[#fc835e]" />
      <span className="absolute top-[404px] left-[172px] size-[16px] bg-[#256cfa]" />

      <p className="absolute top-1/2 left-1/2 -translate-1/2 font-emilio text-[100px] leading-[1.2] tracking-[3px] whitespace-nowrap text-[#fbfbfb] italic">
        Recognize what’s next
      </p>
      <img src={holdingLogo} alt="" className="absolute right-[59.68px] bottom-[60px] h-[72px] w-[385.317px]" />
    </SlideCanvas>
  );
}
