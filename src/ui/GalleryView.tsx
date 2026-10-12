import { memo, type ReactNode } from 'react';
import { ArrowLineDown, ArrowsOutSimple, CheckCircle, Copy, Dot, Warning } from '@phosphor-icons/react';
import { formatDay } from '../lib/time';
import { Slide } from '../slides/Slide';
import { SlideFrame } from '../slides/SlideFrame';
import { templateById, type SlideItem } from '../slides/templates';
import type { SlideActions } from './types';

interface CardProps {
  item: SlideItem;
  selecting: boolean;
  selected: boolean;
  actions: SlideActions;
}

const ActionChip = ({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="flex items-center gap-[4px] rounded-[6px] bg-white p-[4px] text-[12px] leading-[1.5] text-ink shadow-sm hover:bg-canvas"
  >
    {icon}
    {label}
  </button>
);

export const SlideCard = memo(function SlideCard({ item, selecting, selected, actions }: CardProps) {
  const onCardClick = () => (selecting ? actions.toggleSelect(item) : actions.open(item));

  return (
    <article className="group flex flex-col gap-[8px] [contain-intrinsic-size:auto_240px] [content-visibility:auto]">
      {/* The preview background is its own element so hover/selected states can restyle it. */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selecting ? selected : undefined}
        aria-label={selecting ? `Select ${item.title}` : `Open ${item.title}`}
        onClick={onCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCardClick();
          }
        }}
        className={`relative aspect-[269/199] w-full cursor-pointer overflow-hidden rounded-[16px] transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none ${
          selected ? 'bg-accent' : 'bg-preview group-hover:bg-accent'
        }`}
      >
        <div className="absolute top-1/2 left-1/2 w-[85.5%] -translate-1/2 drop-shadow-[0px_4px_7.5px_rgba(37,108,250,0.5)]">
          <SlideFrame>
            <Slide item={item} />
          </SlideFrame>
        </div>

        {selecting ? (
          <CheckCircle
            size={24}
            weight={selected ? 'regular' : 'fill'}
            className={`absolute top-[8px] left-[8px] ${selected ? 'text-white' : 'text-ink/15'}`}
          />
        ) : (
          <div className="absolute top-[8px] right-[8px] hidden flex-col items-end gap-[6px] group-focus-within:flex group-hover:flex">
            <ActionChip label="Open" icon={<ArrowsOutSimple size={16} />} onClick={() => actions.open(item)} />
            <ActionChip label="Copy PNG" icon={<Copy size={16} />} onClick={() => actions.copy(item)} />
            <ActionChip label="Download" icon={<ArrowLineDown size={16} />} onClick={() => actions.download(item)} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[8px]">
        <p className="line-clamp-2 text-[12px] leading-[1.5] text-ink">{item.title}</p>
        <div className="flex items-center gap-[2px] text-[12px] leading-[1.5] text-ink-muted">
          {item.session && (
            <>
              <span>{formatDay(item.session.start)}</span>
              <Dot size={14} weight="fill" className="text-ink-subtle" />
            </>
          )}
          <span>{templateById[item.template].label}</span>
          {item.issues.length > 0 && (
            <Warning size={14} weight="fill" className="ml-[4px] text-[#d97706]" aria-label={item.issues.join('. ')}>
              <title>{item.issues.join('\n')}</title>
            </Warning>
          )}
        </div>
      </div>
    </article>
  );
});

interface Props {
  items: SlideItem[];
  selecting: boolean;
  selected: Set<string>;
  actions: SlideActions;
}

export function GalleryView({ items, selecting, selected, actions }: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-[16px] gap-y-[24px]">
      {items.map((item) => (
        <SlideCard key={item.id} item={item} selecting={selecting} selected={selected.has(item.id)} actions={actions} />
      ))}
    </div>
  );
}
