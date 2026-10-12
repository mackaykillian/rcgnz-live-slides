import { ArrowLineDown, X } from '@phosphor-icons/react';

interface Props {
  count: number;
  busy: boolean;
  onDownload: () => void;
  onClose: () => void;
}

/** Floating toolbar shown while selecting slides for batch download. */
export function SelectionBar({ count, busy, onDownload, onClose }: Props) {
  return (
    <div className="pointer-events-auto flex items-center gap-[26px] rounded-[16px] bg-ink py-[12px] pr-[16px] pl-[24px] shadow-[0_8px_24px_rgba(2,14,30,0.25)]">
      <p className="flex items-center gap-[4px] text-[12px] leading-[1.5] whitespace-nowrap" aria-live="polite">
        <span className="font-bold text-white">{count}</span>
        <span className="text-[#e5e5e5]">{count === 1 ? 'item selected' : 'items selected'}</span>
      </p>
      <button
        type="button"
        onClick={onDownload}
        disabled={count === 0 || busy}
        className="flex items-center gap-[6px] rounded-[8px] bg-accent px-[12px] py-[8px] text-[12px] leading-[1.5] text-white hover:bg-[#1f5fe0] disabled:opacity-50"
      >
        <ArrowLineDown size={16} />
        Download
      </button>
      <button type="button" onClick={onClose} aria-label="Exit selection" className="text-white hover:text-white/70">
        <X size={16} />
      </button>
    </div>
  );
}
