import type { ReactNode } from 'react';
import rcgnzLogo from '../../assets/slides/rcgnz-logo.svg';

/** 1920×1080 slide canvas with the event background. */
export function SlideCanvas({ children }: { children: ReactNode }) {
  return <div className="relative h-[1080px] w-[1920px] overflow-hidden bg-[#020e1e]">{children}</div>;
}

export function SlideLogo() {
  return <img src={rcgnzLogo} alt="" className="absolute right-[39.94px] bottom-[40px] h-[40px] w-[214.065px]" />;
}

export function SessionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="w-[1440px] text-center font-crystal text-[56px] leading-[1.5] font-normal tracking-[1.68px] text-[#fbfbfb]">
      {children}
    </p>
  );
}

/** Space Mono label on the translucent chip (e.g. "UPCOMING SESSION"). */
export function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-space-mono text-[28px] leading-[1.25] tracking-[0.56px] whitespace-nowrap text-[#fbfbfb] uppercase">
      {children}
    </p>
  );
}
