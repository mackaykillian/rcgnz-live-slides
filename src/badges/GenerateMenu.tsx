import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CaretDown, Queue, Repeat, type Icon } from '@phosphor-icons/react';

interface Item {
  label: string;
  icon: Icon;
  onSelect: () => void;
  disabled?: boolean;
  /** Shown on hover, e.g. why it's disabled. */
  hint?: string;
}

interface Props {
  disabled: boolean;
  pendingCount: number;
  onGeneratePending: () => void;
  onRegenerateAll: () => void;
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** "Generate ▾" — Figma "Badges / Generate menu": Generate pending, Regenerate All. */
export function GenerateMenu({ disabled, pendingCount, onGeneratePending, onRegenerateAll }: Props) {
  const [menuOpen, setOpen] = useState(false);
  // A disabled button (e.g. while selecting) never shows its menu.
  const open = menuOpen && !disabled;
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const items: Item[] = [
    {
      label: 'Generate pending',
      icon: Queue,
      onSelect: onGeneratePending,
      disabled: pendingCount === 0,
      hint: pendingCount ? `${pendingCount} badge${pendingCount === 1 ? '' : 's'} to generate` : 'Every badge is up to date',
    },
    { label: 'Regenerate All', icon: Repeat, onSelect: onRegenerateAll, hint: 'Replace every badge in Airtable' },
  ];

  // Close on outside click or Escape; focus the first available item on open.
  useEffect(() => {
    if (!open) return;
    itemRefs.current.find((el) => el && !el.disabled)?.focus();
    const onDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const enabled = itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);
    const i = enabled.indexOf(document.activeElement as HTMLButtonElement);
    enabled[(i + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-[6px] rounded-[8px] bg-accent px-[12px] py-[8px] text-[14px] leading-[1.5] text-white hover:bg-[#1f5fe0] disabled:opacity-50 disabled:hover:bg-accent ${focusRing}`}
      >
        Generate
        <CaretDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Generate badges"
          onKeyDown={onMenuKey}
          className="absolute top-[calc(100%+6px)] right-0 z-30 flex w-[167px] flex-col gap-[2px] rounded-[8px] border border-canvas bg-white p-[4px]"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              data-tooltip={item.hint}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex h-[37px] items-center gap-[6px] rounded-[8px] px-[8px] py-[6px] text-[14px] leading-[1.5] whitespace-nowrap text-ink outline-none hover:bg-overlay-subtle focus-visible:bg-overlay-subtle disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <item.icon size={16} className="shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
