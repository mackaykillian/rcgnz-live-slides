import { CaretRight, CheckCircle, List, SidebarSimple, SquaresFour } from '@phosphor-icons/react';
import { Fragment } from 'react';

export type ViewMode = 'gallery' | 'list';

interface Props {
  /** Breadcrumb, e.g. ["All Slides"] or ["Slides", "Standard"]. */
  crumbs: string[];
  showControls: boolean;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  selecting: boolean;
  onToggleSelect: () => void;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
}

export function ViewHeader(props: Props) {
  const toggleItem = (mode: ViewMode, label: string, Icon: typeof List) => {
    const active = props.viewMode === mode;
    return (
      <button
        type="button"
        onClick={() => props.onViewMode(mode)}
        aria-pressed={active}
        className={`flex items-center gap-[6px] text-[14px] leading-[1.5] ${active ? 'text-ink' : 'text-ink-subtle hover:text-ink-muted'}`}
      >
        <Icon size={16} />
        {label}
      </button>
    );
  };

  return (
    <header className="flex h-[37px] shrink-0 items-center justify-between">
      <div className="flex items-center gap-[8px] text-[24px] leading-none">
        {props.sidebarCollapsed && (
          <button
            type="button"
            onClick={props.onExpandSidebar}
            aria-label="Expand sidebar"
            className="mr-[4px] rounded p-[4px] hover:bg-overlay-subtle"
          >
            <SidebarSimple size={20} />
          </button>
        )}
        {props.crumbs.map((crumb, i) => (
          <Fragment key={crumb}>
            {i > 0 && <CaretRight size={16} className="text-ink-muted" />}
            <h1 className="font-medium">{crumb}</h1>
          </Fragment>
        ))}
      </div>

      {props.showControls && (
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={props.onToggleSelect}
            aria-pressed={props.selecting}
            className={`flex items-center gap-[6px] rounded-[8px] px-[12px] py-[8px] text-[14px] leading-[1.5] ${props.selecting ? 'bg-accent text-white' : 'bg-white text-ink hover:bg-white/70'}`}
          >
            <CheckCircle size={16} />
            Select
          </button>
          <div className="flex items-center gap-[14px] rounded-[8px] bg-white px-[12px] py-[8px]">
            {toggleItem('list', 'List', List)}
            {toggleItem('gallery', 'Gallery', SquaresFour)}
          </div>
        </div>
      )}
    </header>
  );
}
