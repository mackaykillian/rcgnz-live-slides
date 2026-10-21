import { useState, type ReactNode } from 'react';
import {
  ArrowsClockwise,
  ArrowUpRight,
  CaretDown,
  CalendarBlank,
  CaretRight,
  Cloud,
  FigmaLogo,
  IdentificationBadge,
  ImageSquare,
  ImagesSquare,
  MapPin,
  Presentation,
  SidebarSimple,
  Table,
} from '@phosphor-icons/react';
import rcgnzLogo from '../assets/ui/rcgnz-logo-dark.svg';
import { EVENT_NAME, LINKS } from '../config';
import { formatSyncedAt } from '../lib/time';
import { routeHref, type Route } from '../lib/useRoute';
import { TEMPLATES } from '../slides/templates';
import { DECKS } from '../slideshows/decks';

interface Props {
  route: Route;
  syncedAt: string | null;
  isMock: boolean;
  syncing: boolean;
  onSync: () => void;
  onCollapse: () => void;
  bizzaboRunning: boolean;
  onFetchBizzabo: () => void;
}

type Highlight = 'accent' | 'neutral' | 'none';

/**
 * Keyboard focus ring drawn inside the item's border. The default outline sits
 * outside the box and gets clipped by the sidebar's scroll container.
 */
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset';

const highlightClass: Record<Highlight, string> = {
  accent: 'bg-accent-soft text-accent',
  neutral: 'bg-overlay-subtle text-ink',
  none: 'text-ink hover:bg-overlay-subtle',
};

/** A parent menu row (Slides, Slide show) with an expand caret, à la Google Drive. */
function ParentItem(props: {
  href: string;
  icon: ReactNode;
  label: string;
  highlight: Highlight;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex w-full items-center gap-[6px] rounded-[6px] px-[8px] py-[7px] text-[14px] leading-[18px] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent has-[a:focus-visible]:ring-inset ${highlightClass[props.highlight]}`}
    >
      <button
        type="button"
        onClick={props.onToggle}
        aria-label={props.expanded ? `Collapse ${props.label}` : `Expand ${props.label}`}
        aria-expanded={props.expanded}
        className={`-m-[2px] rounded-[4px] p-[2px] ${focusRing}`}
      >
        <CaretRight size={12} weight="fill" className={`transition-transform ${props.expanded ? 'rotate-90' : ''}`} />
      </button>
      <a href={props.href} className="flex flex-1 items-center gap-[6px] outline-none">
        {props.icon}
        {props.label}
      </a>
    </div>
  );
}

function ChildItem(props: { href: string; icon: ReactNode; label: string; active: boolean }) {
  return (
    <a
      href={props.href}
      aria-current={props.active ? 'page' : undefined}
      className={`flex w-full items-center gap-[6px] overflow-hidden rounded-[6px] py-[7px] pl-[32px] text-[14px] leading-[18px] ${focusRing} ${highlightClass[props.active ? 'accent' : 'none']}`}
    >
      {props.icon}
      <span className="flex-1 truncate">{props.label}</span>
    </a>
  );
}

function ExternalItem(props: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer"
      className={`flex w-full items-center justify-between rounded-[6px] px-[8px] py-[7px] text-[14px] leading-[18px] text-ink hover:bg-overlay-subtle ${focusRing}`}
    >
      <span className="flex items-center gap-[6px]">
        {props.icon}
        {props.label}
      </span>
      <ArrowUpRight size={16} />
    </a>
  );
}

export function Sidebar({ route, syncedAt, isMock, syncing, onSync, onCollapse, bizzaboRunning, onFetchBizzabo }: Props) {
  const [slidesOpen, setSlidesOpen] = useState(true);
  const [showOpen, setShowOpen] = useState(true);

  const inSlides = route.section === 'slides';
  const inShow = route.section === 'slideshow';
  const inCalendar = route.section === 'calendar';
  const slidesHighlight: Highlight = inSlides ? (route.template ? 'neutral' : 'accent') : 'none';
  const showHighlight: Highlight = inShow ? (route.deck ? 'neutral' : 'accent') : 'none';

  return (
    <nav className="flex h-full w-[248px] shrink-0 flex-col p-[24px]" aria-label="Main">
      <div className="flex items-center justify-between">
        <div className="flex w-[82px] flex-col gap-[5px]">
          <img src={rcgnzLogo} alt="RCGNZ" className="h-[8.035px] w-[43px]" />
          <p className="text-[16px] leading-none">Live Slides</p>
        </div>
        <button type="button" onClick={onCollapse} aria-label="Collapse sidebar" className={`rounded p-[4px] hover:bg-overlay-subtle ${focusRing}`}>
          <SidebarSimple size={20} />
        </button>
      </div>

      <div className="mt-[24px] flex flex-1 flex-col justify-between overflow-y-auto [scrollbar-width:thin]">
        <div className="flex flex-col gap-[24px]">
          <div className="flex flex-col gap-[8px]">
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className={`flex w-full items-center justify-center gap-[4px] rounded-[8px] bg-accent px-[8px] py-[12px] text-[14px] leading-none text-white hover:bg-[#1f5fe0] disabled:opacity-80 ${focusRing} focus-visible:ring-white/70`}
            >
              <ArrowsClockwise size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
            <p className="text-[12px] leading-none text-ink-muted">
              {syncedAt ? `last synced: ${formatSyncedAt(syncedAt)}` : 'not synced yet'}
              {isMock && ' · sample data'}
            </p>
          </div>

          <div className="flex flex-col gap-[24px]">
            <div className="flex flex-col">
              <ParentItem
                href={routeHref({ section: 'slides', template: null })}
                icon={<ImagesSquare size={16} />}
                label="Slides"
                highlight={slidesHighlight}
                expanded={slidesOpen}
                onToggle={() => setSlidesOpen((o) => !o)}
              />
              {slidesOpen &&
                TEMPLATES.map((t) => (
                  <ChildItem
                    key={t.id}
                    href={routeHref({ section: 'slides', template: t.id })}
                    icon={<ImageSquare size={16} />}
                    label={t.label}
                    active={inSlides && route.template === t.id}
                  />
                ))}
            </div>

            <div className="flex flex-col">
              <ParentItem
                href={routeHref({ section: 'slideshow', deck: null, slide: null })}
                icon={<Presentation size={16} />}
                label="Slide show"
                highlight={showHighlight}
                expanded={showOpen}
                onToggle={() => setShowOpen((o) => !o)}
              />
              {showOpen &&
                DECKS.map((deck) => (
                  <ChildItem
                    key={deck.id}
                    href={routeHref({ section: 'slideshow', deck: deck.id, slide: null })}
                    icon={<MapPin size={16} />}
                    label={deck.name}
                    active={inShow && route.deck === deck.id}
                  />
                ))}
            </div>

            <a
              href={routeHref({ section: 'calendar', day: null })}
              aria-current={inCalendar ? 'page' : undefined}
              className={`flex w-full items-center gap-[6px] rounded-[6px] px-[8px] py-[7px] text-[14px] leading-[18px] ${focusRing} ${highlightClass[inCalendar ? 'accent' : 'none']}`}
            >
              <CalendarBlank size={16} className="shrink-0" />
              <span className="truncate">Agenda Timeline View</span>
            </a>

            <div className="flex flex-col">
              <ExternalItem href={LINKS.airtable} icon={<Table size={16} />} label="Airtable base" />
              <ExternalItem href={LINKS.figma} icon={<FigmaLogo size={16} />} label="Figma file" />
            </div>
          </div>

          <div className="flex flex-col gap-[4px]">
            <p className="text-[10px] leading-none text-ink-muted">Admin only</p>
            <button
              type="button"
              onClick={onFetchBizzabo}
              disabled={bizzaboRunning}
              aria-busy={bizzaboRunning}
              className={`flex w-full items-center justify-between rounded-[6px] px-[8px] py-[7px] text-[14px] leading-[18px] text-ink hover:bg-overlay-subtle disabled:cursor-progress disabled:hover:bg-transparent ${focusRing}`}
            >
              <span className="flex items-center gap-[6px]">
                <Cloud size={16} />
                Fetch Bizzabo
              </span>
              {/* Only shown while the fetch is running. */}
              {bizzaboRunning && <ArrowsClockwise size={16} className="animate-spin" aria-label="Fetching" />}
            </button>
            <a
              href={routeHref({ section: 'badges' })}
              aria-current={route.section === 'badges' ? 'page' : undefined}
              className={`flex w-full items-center gap-[6px] rounded-[6px] px-[8px] py-[7px] text-[14px] leading-[18px] ${focusRing} ${highlightClass[route.section === 'badges' ? 'accent' : 'none']}`}
            >
              <IdentificationBadge size={16} className="shrink-0" />
              Badges
            </a>
          </div>
        </div>

        <div className="mt-[24px] flex flex-col gap-[12px]">
          <p className="text-[10px] leading-none text-ink-muted">Event</p>
          <div className="flex items-center gap-[6px]">
            <p className="text-[14px] leading-none">{EVENT_NAME}</p>
            <CaretDown size={16} className="text-ink-subtle" aria-hidden />
          </div>
        </div>
      </div>
    </nav>
  );
}
