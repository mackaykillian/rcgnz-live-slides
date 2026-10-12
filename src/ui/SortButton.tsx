import { ArrowDown, ArrowUp } from '@phosphor-icons/react';
import type { SlideQuery, SortKey } from '../lib/filterSlides';

interface Props {
  label: string;
  sortKey: SortKey;
  sort: SlideQuery['sort'];
  onSort: (key: SortKey) => void;
}

/** Inactive: subtle text. Active: bold text + accent arrow for the direction. */
export function SortButton({ label, sortKey, sort, onSort }: Props) {
  const active = sort.key === sortKey;
  const Arrow = sort.dir === 'asc' ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}${active ? (sort.dir === 'asc' ? ', ascending' : ', descending') : ''}`}
      className={`flex items-center gap-[4px] text-[14px] leading-[1.5] ${active ? 'text-ink' : 'text-ink-subtle hover:text-ink-muted'}`}
    >
      {label}
      {active && <Arrow size={16} className="text-accent" />}
    </button>
  );
}
