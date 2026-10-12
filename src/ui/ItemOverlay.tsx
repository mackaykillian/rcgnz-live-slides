import { useEffect, type ReactNode } from 'react';
import { ArrowLineDown, CaretLeft, CaretRight, Copy, X } from '@phosphor-icons/react';
import { formatDay, formatTimeRange } from '../lib/time';
import { Slide } from '../slides/Slide';
import { SlideFrame } from '../slides/SlideFrame';
import { templateById, type SlideItem } from '../slides/templates';

interface Props {
  item: SlideItem;
  onClose: () => void;
  onCopy: (item: SlideItem) => void;
  onDownload: (item: SlideItem) => void;
  /** Step through the current (filtered, sorted) list with ← / →. */
  onPrev?: () => void;
  onNext?: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-[32px] text-[12px] leading-[1.5] text-white">
      <p>{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Google Drive–style large preview. Clicking the backdrop or pressing Esc closes it. */
export function ItemOverlay({ item, onClose, onCopy, onDownload, onPrev, onNext }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev?.();
      if (e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const s = item.session;
  const navButton = 'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-[10px] text-white hover:bg-white/20';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/80 px-[24px] py-[37px] backdrop-blur-md"
    >
      {onPrev && (
        <button type="button" aria-label="Previous slide" className={`${navButton} left-[24px]`} onClick={(e) => (e.stopPropagation(), onPrev())}>
          <CaretLeft size={20} />
        </button>
      )}
      {onNext && (
        <button type="button" aria-label="Next slide" className={`${navButton} right-[24px]`} onClick={(e) => (e.stopPropagation(), onNext())}>
          <CaretRight size={20} />
        </button>
      )}

      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[24px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-[16px]">
          <div className="flex min-w-0 items-center gap-[16px]">
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-white hover:text-white/70">
              <X size={24} />
            </button>
            <h2 className="truncate text-[24px] leading-[1.5] font-medium text-white">{item.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-[8px]">
            <button
              type="button"
              onClick={() => onCopy(item)}
              className="flex items-center gap-[6px] rounded-[8px] bg-white/10 px-[12px] py-[8px] text-[14px] leading-[1.5] text-white hover:bg-white/20"
            >
              <Copy size={16} />
              Copy as PNG
            </button>
            <button
              type="button"
              onClick={() => onDownload(item)}
              className="flex items-center gap-[6px] rounded-[8px] bg-accent px-[12px] py-[8px] text-[14px] leading-[1.5] text-white hover:bg-[#1f5fe0]"
            >
              <ArrowLineDown size={16} />
              Download
            </button>
          </div>
        </div>

        <SlideFrame>
          <Slide item={item} />
        </SlideFrame>

        <div className="flex flex-col gap-[16px]">
          <Row label="Slide">{templateById[item.template].label}</Row>
          {s && (
            <>
              <Row label="Date / Time">
                <span className="flex gap-[8px]">
                  <span>{formatDay(s.start)}</span>
                  <span>{formatTimeRange(s.start, s.end)}</span>
                </span>
              </Row>
              <Row label="Room">{s.room ?? '—'}</Row>
              <Row label="Speakers">
                {item.speakers.length === 0 ? (
                  '—'
                ) : (
                  <div className="flex flex-wrap items-center gap-[12px]">
                    {item.speakers.map((sp) => {
                      const avatar = sp.headshots.sunset ?? sp.headshots.aqua ?? sp.headshots.transparent;
                      return (
                        <span key={sp.id} className="flex items-center gap-[6px] text-[#e5e5e5]">
                          {avatar ? (
                            <img src={avatar.url} alt="" className="size-[20px] rounded-full bg-white/10 object-cover object-top" />
                          ) : (
                            <span className="size-[20px] rounded-full bg-white/10" />
                          )}
                          <span className="leading-none">{sp.name}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </Row>
              {s.tags.length > 0 && <Row label="Tags">{s.tags.join(', ')}</Row>}
              <Row label="SHRM code">{s.shrmCode ?? '—'}</Row>
            </>
          )}
          {item.issues.length > 0 && (
            <Row label="Heads up">
              <ul className="text-[#fbbf24]">
                {item.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </Row>
          )}
        </div>
      </div>
    </div>
  );
}
