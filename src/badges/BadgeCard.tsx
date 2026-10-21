import { useLayoutEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BADGE_HEIGHT, BADGE_WIDTH, type BadgeData } from '../../shared/badges';
import awardcoLogo from '../assets/badges/awardco-logo.svg';
import cropMarks from '../assets/badges/crop-marks.svg';
import summitLogo from '../assets/badges/rcgnz-summit-logo.svg';
import { fitBadgeText, useBadgeFontsReady } from './fitText';
import { BADGE_STYLES } from './styles';

/**
 * The printed badge, 1:1 with the Figma frame (units are points; rendered at
 * 300 DPI for print). Trim + bleed, with crop marks on top.
 */
export function BadgeCard({ data }: { data: BadgeData }) {
  const style = BADGE_STYLES[data.type];
  const Icon = style.icon;
  const ref = useRef<HTMLDivElement>(null);
  const fontsReady = useBadgeFontsReady();

  useLayoutEffect(() => {
    if (ref.current) fitBadgeText(ref.current);
  }, [data, fontsReady]);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden bg-[#fbfbfb] text-[#020e1e]"
      style={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }}
      data-badge-type={data.type}
    >
      <img src={style.background} alt="" className="absolute inset-0 size-full" />

      {/* Lanyard slot */}
      <div className="absolute top-[25px] left-[calc(50%+1.44px)] h-[8px] w-[38px] -translate-x-1/2 rounded-full bg-[#020e1e]" />

      <img
        src={summitLogo}
        alt="RCGNZ Summit"
        className="absolute top-[72px] left-[calc(50%+0.16px)] h-[41px] w-[133px] -translate-x-1/2"
      />

      <div className="absolute top-[144px] left-[27px] flex w-[217px] flex-col items-center gap-[8px]">
        <div
          className={`flex items-center justify-center gap-[4px] py-[6px] ${Icon ? 'px-[8px]' : 'px-[12px]'}`}
          style={{ backgroundColor: style.accent, color: style.onAccent }}
        >
          {Icon && <Icon size={12} className="shrink-0" />}
          <span className="font-space-mono text-[8px] leading-[1.15] tracking-[0.05em] whitespace-nowrap uppercase">
            {style.label}
          </span>
        </div>

        <div className="flex w-full flex-col items-center gap-[8px] text-center">
          <div className="w-full font-crystal font-medium text-black">
            <p data-fit="line" data-max="18" data-min="11" className="w-full leading-[1.15] tracking-[0.05em]">
              {data.firstName}
            </p>
            <p data-fit="line" data-max="18" data-min="11" className="w-full leading-[1.15] tracking-[0.05em]">
              {data.lastName}
            </p>
          </div>
          <p
            data-fit="lines"
            data-lines="2"
            data-max="12"
            data-min="8"
            className="w-full font-crystal font-normal leading-[1.15] tracking-[0.02em] text-balance"
          >
            {data.company}
          </p>
        </div>
      </div>

      <div
        className="absolute top-[267px] left-1/2 flex size-[72px] -translate-x-1/2 items-center justify-center border-2 bg-[#fbfbfb]"
        style={{ borderColor: style.accent, boxShadow: `4px 4px 0 0 ${style.accent}` }}
      >
        <QRCodeSVG value={data.qrLink} size={56} level="M" marginSize={0} bgColor="#fbfbfb" fgColor="#000000" />
      </div>

      <img src={awardcoLogo} alt="Awardco" className="absolute top-[373px] left-[89px] h-[16px] w-[92.308px]" />
      <img src={cropMarks} alt="" className="absolute inset-0 size-full" />
    </div>
  );
}

/** The standalone QR for the "QR Code" column: Bizzabo-style plain black on white with a quiet zone. */
export function BadgeQr({ value, size }: { value: string; size: number }) {
  return <QRCodeSVG value={value} size={size} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" />;
}
