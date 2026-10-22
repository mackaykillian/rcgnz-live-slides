import type { ReactNode } from 'react';
import { ArrowLineDown, X } from '@phosphor-icons/react';

interface Props {
  count: number;
  busy: boolean;
  onDownload: () => void;
  onClose: () => void;
  /** Download button text (default "Download"). */
  downloadLabel?: string;
  /** Disables the download and explains why (e.g. over the printer limit). */
  blockedReason?: string | null;
  /** Extra controls between the count and the download button. */
  children?: ReactNode;
}

/** Floating toolbar shown while selecting items for download. */
export function SelectionBar({ count, busy, onDownload, onClose, downloadLabel = 'Download', blockedReason, children }: Props) {
  return (
    <div className="pointer-events-auto flex items-center gap-[26px] rounded-[16px] bg-ink py-[12px] pr-[16px] pl-[24px] shadow-[0_8px_24px_rgba(2,14,30,0.25)]">
      <p className="flex items-center gap-[4px] text-[12px] leading-[1.5] whitespace-nowrap" aria-live="polite">
        <span className="font-bold text-white">{count}</span>
        <span className="text-[#e5e5e5]">{count === 1 ? 'item selected' : 'items selected'}</span>
      </p>
      {children}
      {blockedReason && <p className="text-[12px] leading-[1.5] whitespace-nowrap text-[#fc835e]">{blockedReason}</p>}
      <button
        type="button"
        onClick={onDownload}
        disabled={count === 0 || busy || !!blockedReason}
        className="flex items-center gap-[6px] rounded-[8px] bg-accent px-[12px] py-[8px] text-[12px] leading-[1.5] whitespace-nowrap text-white hover:bg-[#1f5fe0] disabled:opacity-50"
      >
        <ArrowLineDown size={16} />
        {busy ? 'Rendering…' : downloadLabel}
      </button>
      <button type="button" onClick={onClose} aria-label="Exit selection" className="text-white hover:text-white/70">
        <X size={16} />
      </button>
    </div>
  );
}
