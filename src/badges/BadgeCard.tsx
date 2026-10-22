import { useLayoutEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BLEED, BLEED_HEIGHT, BLEED_WIDTH, PAGE_HEIGHT, PAGE_WIDTH, SLUG, type BadgeData } from '../../shared/badges';
import awardcoLogo from '../assets/badges/awardco-logo.svg';
import summitLogo from '../assets/badges/rcgnz-summit-logo.svg';
import { fitBadgeText, useBadgeFontsReady } from './fitText';
import { BADGE_STYLES } from './styles';

/** Where the trim lines fall, measured from the page edge. */
const TRIM_INSET = SLUG + BLEED;

/**
 * Crop marks: a pair at each corner on the trim lines, in the slug only — from
 * the page edge to the bleed edge, so they never touch the artwork.
 */
function CropMarks() {
  const x = [TRIM_INSET, PAGE_WIDTH - TRIM_INSET];
  const y = [TRIM_INSET, PAGE_HEIGHT - TRIM_INSET];
  const lines: [number, number, number, number][] = [];
  for (const [i, xi] of x.entries()) {
    const edgeX = i === 0 ? 0 : PAGE_WIDTH;
    const slugX = i === 0 ? SLUG : PAGE_WIDTH - SLUG;
    for (const [j, yj] of y.entries()) {
      const edgeY = j === 0 ? 0 : PAGE_HEIGHT;
      const slugY = j === 0 ? SLUG : PAGE_HEIGHT - SLUG;
      lines.push([edgeX, yj, slugX, yj], [xi, edgeY, xi, slugY]);
    }
  }
  return (
    <svg className="absolute inset-0" width={PAGE_WIDTH} height={PAGE_HEIGHT} viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`} aria-hidden>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth={0.5} />
      ))}
    </svg>
  );
}

/**
 * The printed badge as a full PDF page (units are points; 1 CSS px = 1 pt):
 * white slug with crop marks, around the artwork (trim + bleed). Badge content
 * is centered on the artwork as in Figma.
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
    <div className="relative bg-white" style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }} data-badge-type={data.type}>
      <div
        ref={ref}
        className="absolute overflow-hidden bg-[#fbfbfb] text-[#020e1e]"
        style={{ left: SLUG, top: SLUG, width: BLEED_WIDTH, height: BLEED_HEIGHT }}
      >
        {/* Stretched ~1% wider than its 267.5pt source to cover the full bleed. */}
        <img src={style.background} alt="" className="absolute inset-0 size-full" />

        <img src={summitLogo} alt="RCGNZ Summit" className="absolute top-[72px] left-1/2 h-[41px] w-[133px] -translate-x-1/2" />

        <div className="absolute top-[144px] left-1/2 flex w-[217px] -translate-x-1/2 flex-col items-center gap-[8px]">
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

        <img src={awardcoLogo} alt="Awardco" className="absolute top-[373px] left-1/2 h-[16px] w-[92.308px] -translate-x-1/2" />
      </div>
      <CropMarks />
    </div>
  );
}

/** The standalone QR for the "QR Code" column: Bizzabo-style plain black on white with a quiet zone. */
export function BadgeQr({ value, size }: { value: string; size: number }) {
  return <QRCodeSVG value={value} size={size} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" />;
}
