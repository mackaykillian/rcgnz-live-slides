import { memo } from 'react';
import { ArrowsOutSimple, Copy, Warning } from '@phosphor-icons/react';
import type { SlideQuery, SortKey } from '../lib/filterSlides';
import { formatDay, formatTimeRange } from '../lib/time';
import { Slide } from '../slides/Slide';
import { SlideFrame } from '../slides/SlideFrame';
import { templateById, type SlideItem } from '../slides/templates';
import { SortButton } from './SortButton';
import type { SlideActions } from './types';

/** Thumbnail | Name | Date / Time | Slide | Room | actions — from the Figma "Session Row" grid. */
const GRID = 'grid grid-cols-[71.111px_minmax(0,1fr)_200px_120px_120px_70px] items-center gap-x-[32px] px-[12px]';

interface RowProps {
  item: SlideItem;
  selecting: boolean;
  selected: boolean;
  actions: SlideActions;
}

const ListRow = memo(function ListRow({ item, selecting, selected, actions }: RowProps) {
  const onRowClick = () => (selecting ? actions.toggleSelect(item) : actions.open(item));
  const s = item.session;
  const iconButton = selected ? 'bg-ink/10 text-white hover:bg-ink/20' : 'bg-overlay-subtle text-ink hover:bg-ink/10';

  return (
    <div
      role="row"
      aria-selected={selecting ? selected : undefined}
      onClick={onRowClick}
      className={`${GRID} cursor-pointer border-b py-[16px] text-[14px] leading-[1.5] [contain-intrinsic-size:auto_73px] [content-visibility:auto] ${
        selected ? 'border-white/50 bg-accent text-white' : 'border-ink-subtle text-ink hover:bg-canvas/60'
      }`}
    >
      <div className="w-[71.111px] drop-shadow-[0px_1.805px_3.384px_rgba(37,108,250,0.5)]">
        <SlideFrame>
          <Slide item={item} />
        </SlideFrame>
      </div>
      <p className="flex items-center gap-[6px] truncate" title={item.title}>
        <span className="truncate">{item.title}</span>
        {item.issues.length > 0 && (
          <Warning size={14} weight="fill" className={`shrink-0 ${selected ? 'text-white' : 'text-[#d97706]'}`}>
            <title>{item.issues.join('\n')}</title>
          </Warning>
        )}
      </p>
      <div className="flex items-center gap-[8px] whitespace-nowrap">
        <span>{formatDay(s?.start ?? null)}</span>
        <span className="truncate">{formatTimeRange(s?.start ?? null, s?.end ?? null)}</span>
      </div>
      <p className="truncate">{templateById[item.template].label}</p>
      <p className="truncate">{s?.room ?? '—'}</p>
      <div className="flex items-center gap-[6px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => actions.open(item)}
          aria-label={`Open ${item.title}`}
          className={`rounded-[8px] p-[6px] ${iconButton}`}
        >
          <ArrowsOutSimple size={20} />
        </button>
        <button
          type="button"
          onClick={() => actions.copy(item)}
          aria-label={`Copy ${item.title} as PNG`}
          className={`rounded-[8px] p-[6px] ${iconButton}`}
        >
          <Copy size={20} />
        </button>
      </div>
    </div>
  );
});

interface Props {
  items: SlideItem[];
  selecting: boolean;
  selected: Set<string>;
  actions: SlideActions;
  sort: SlideQuery['sort'];
  onSort: (key: SortKey) => void;
}

export function ListView({ items, selecting, selected, actions, sort, onSort }: Props) {
  return (
    <div role="table" className="flex flex-col">
      <div role="row" className={`${GRID} border-b border-ink-subtle pb-[17px]`}>
        <span />
        <SortButton label="Name" sortKey="name" sort={sort} onSort={onSort} />
        <SortButton label="Date / Time" sortKey="date" sort={sort} onSort={onSort} />
        <SortButton label="Slide" sortKey="slide" sort={sort} onSort={onSort} />
        <span className="text-[14px] leading-[1.5] text-ink-subtle">Room</span>
        <span />
      </div>
      {items.map((item) => (
        <ListRow key={item.id} item={item} selecting={selecting} selected={selected.has(item.id)} actions={actions} />
      ))}
    </div>
  );
}
