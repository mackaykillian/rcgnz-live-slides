import { useCallback, useMemo, useState } from 'react';
import { AdminAuthError, clearAdminPasscode, fetchBizzabo, getAdminPasscode, setAdminPasscode } from './data/admin';
import { useSnapshot } from './data/useSnapshot';
import { CalendarView } from './calendar/CalendarView';
import { copySlide, downloadSlide, downloadSlides } from './export/exportSlides';
import { DEFAULT_SORT, filterAndSortSlides, type SlideQuery, type SortKey } from './lib/filterSlides';
import { useLocalStorage } from './lib/useLocalStorage';
import { useRoute } from './lib/useRoute';
import { buildSlides } from './slides/buildSlides';
import { templateById, type SlideItem, type TemplateId } from './slides/templates';
import { resolveDeck } from './slideshows/deck';
import { DECKS, deckById } from './slideshows/decks';
import { Filters } from './ui/Filters';
import { GalleryView } from './ui/GalleryView';
import { ItemOverlay } from './ui/ItemOverlay';
import { ListView } from './ui/ListView';
import { PasscodeDialog } from './ui/PasscodeDialog';
import { SelectionBar } from './ui/SelectionBar';
import { Sidebar } from './ui/Sidebar';
import { SortButton } from './ui/SortButton';
import { Toast, useToast } from './ui/Toast';
import { TooltipLayer } from './ui/Tooltip';
import { ViewHeader, type ViewMode } from './ui/ViewHeader';
import type { SlideActions } from './ui/types';
import { DeckView } from './ui/slideshow/DeckView';
import { SlideshowGallery } from './ui/slideshow/SlideshowGallery';

const VIEW_MODES = ['gallery', 'list'] as const;

export default function App() {
  const { snapshot, loading, syncing, error, sync, replaceSnapshot } = useSnapshot();
  const [route, navigate] = useRoute();
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('rcgnz:viewMode', 'gallery', VIEW_MODES);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [search, setSearch] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [sort, setSort] = useState<SlideQuery['sort']>(DEFAULT_SORT);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { toast, show } = useToast();

  // The sidebar's template sub-menu and the "Slide" dropdown are the same filter.
  const template = route.section === 'slides' ? route.template : null;
  const setTemplate = useCallback(
    (t: TemplateId | null) => navigate({ section: 'slides', template: t }),
    [navigate],
  );

  const allSlides = useMemo(() => (snapshot ? buildSlides(snapshot) : []), [snapshot]);
  // Rooms that have at least one slide (speakerless sessions produce none).
  const rooms = useMemo(
    () => [...new Set(allSlides.map((s) => s.session?.room).filter((r): r is string => !!r))].sort(),
    [allSlides],
  );
  const slides = useMemo(
    () => filterAndSortSlides(allSlides, { search, template, day, room, sort }),
    [allSlides, search, template, day, room, sort],
  );
  const slideById = useMemo(() => new Map(allSlides.map((s) => [s.id, s])), [allSlides]);
  const decks = useMemo(() => DECKS.map((d) => resolveDeck(d, allSlides)), [allSlides]);
  const activeDeckDef = route.section === 'slideshow' ? deckById(route.deck) : null;
  const activeDeck = activeDeckDef ? decks.find((d) => d.definition === activeDeckDef)! : null;
  const onSlideKey = useCallback(
    (slide: string) => activeDeckDef && navigate({ section: 'slideshow', deck: activeDeckDef.id, slide }, { replace: true }),
    [activeDeckDef, navigate],
  );

  const onSort = useCallback((key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }, []);

  const exitSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const runExport = useCallback(
    async (label: string, task: () => Promise<void>, done: string) => {
      setExporting(true);
      show('busy', label);
      try {
        await task();
        show('success', done);
      } catch (err) {
        console.error(err);
        show('error', `Export failed: ${(err as Error).message}`);
      } finally {
        setExporting(false);
      }
    },
    [show],
  );

  const actions: SlideActions = useMemo(
    () => ({
      open: (item) => setOpenId(item.id),
      copy: (item) => void runExport('Rendering 4K PNG…', () => copySlide(item), 'Copied to clipboard'),
      download: (item) => void runExport('Rendering 4K PNG…', () => downloadSlide(item), 'Downloaded'),
      toggleSelect: (item) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        }),
    }),
    [runExport],
  );

  const downloadSelected = () => {
    // Keep the on-screen order so the zip matches what the user sees.
    const items = slides.filter((s) => selected.has(s.id));
    const hidden = [...selected].filter((id) => !items.some((s) => s.id === id));
    items.push(...hidden.map((id) => slideById.get(id)).filter((s): s is SlideItem => !!s));
    void runExport(
      `Rendering 0 / ${items.length}…`,
      () => downloadSlides(items, (done, total) => show('busy', `Rendering ${done} / ${total}…`)),
      `Downloaded ${items.length} slide${items.length === 1 ? '' : 's'}`,
    );
  };

  // "Fetch Bizzabo" (admin only): Bizzabo → Airtable, then Airtable → slides.
  const [bizzaboRunning, setBizzaboRunning] = useState(false);
  const [passcodePrompt, setPasscodePrompt] = useState<{ error: string | null } | null>(null);

  const runBizzaboFetch = async (passcode: string) => {
    setBizzaboRunning(true);
    try {
      const result = await fetchBizzabo(passcode);
      if (result.snapshot) replaceSnapshot(result.snapshot);
      show('success', 'Bizzabo fetch success');
    } catch (err) {
      if (err instanceof AdminAuthError) {
        clearAdminPasscode();
        setPasscodePrompt({ error: err.message });
      } else {
        console.error(err);
        show('error', `Bizzabo fetch failed: ${(err as Error).message}`);
      }
    } finally {
      setBizzaboRunning(false);
    }
  };

  const onFetchBizzabo = () => {
    const saved = getAdminPasscode();
    if (saved) void runBizzaboFetch(saved);
    else setPasscodePrompt({ error: null });
  };

  const onSync = async () => {
    const ok = await sync();
    show(ok ? 'success' : 'error', ok ? 'Synced with Airtable' : 'Sync failed — see console');
  };

  // If the open slide disappears after a sync, the overlay simply doesn't render.
  const openItem = openId ? slideById.get(openId) : undefined;
  const openIndex = openItem ? slides.findIndex((s) => s.id === openItem.id) : -1;

  const crumbs =
    route.section === 'calendar'
      ? ['Agenda Timeline View']
      : route.section === 'slideshow'
      ? activeDeck
        ? ['Slideshow', activeDeck.definition.name]
        : ['All Slideshows']
      : template
        ? ['Slides', templateById[template].label]
        : ['All Slides'];

  return (
    <div className="flex h-full overflow-x-clip">
      {!sidebarCollapsed && (
        <Sidebar
          route={route}
          syncedAt={snapshot?.syncedAt || null}
          isMock={snapshot?.source === 'mock'}
          syncing={syncing}
          onSync={onSync}
          onCollapse={() => setSidebarCollapsed(true)}
          bizzaboRunning={bizzaboRunning}
          onFetchBizzabo={onFetchBizzabo}
        />
      )}

      <main className={`relative flex min-w-0 flex-1 flex-col gap-[16px] pt-[19px] pr-[20px] pb-[13px] ${sidebarCollapsed ? 'pl-[20px]' : 'pl-[4px]'}`}>
        <ViewHeader
          crumbs={crumbs}
          showControls={route.section === 'slides'}
          viewMode={viewMode}
          onViewMode={setViewMode}
          selecting={selecting}
          onToggleSelect={() => (selecting ? exitSelecting() : setSelecting(true))}
          sidebarCollapsed={sidebarCollapsed}
          onExpandSidebar={() => setSidebarCollapsed(false)}
        />

        <section
          className={`min-h-0 flex-1 rounded-[8px] p-[32px] ${
            route.section === 'calendar'
              ? 'bg-ink'
              : route.section === 'slideshow'
                ? activeDeck
                  ? 'bg-[#1b2635]'
                  : 'overflow-y-auto bg-ink'
                : 'overflow-y-auto bg-white'
          }`}
        >
          {route.section === 'calendar' ? (
            snapshot ? (
              <CalendarView
                snapshot={snapshot}
                day={route.day}
                onDay={(day) => navigate({ section: 'calendar', day }, { replace: true })}
              />
            ) : (
              <p className="py-[48px] text-center text-[14px] text-white/60">Loading sessions…</p>
            )
          ) : route.section === 'slideshow' ? (
            loading ? (
              <p className="py-[48px] text-center text-[14px] text-white/60">Loading slideshows…</p>
            ) : activeDeck ? (
              <DeckView deck={activeDeck} slideKey={route.slide} onSlideKey={onSlideKey} />
            ) : (
              <SlideshowGallery decks={decks} />
            )
          ) : (
            <div className="flex flex-col gap-[16px] pb-[72px]">
              <Filters
                search={search}
                onSearch={setSearch}
                template={template}
                onTemplate={setTemplate}
                day={day}
                onDay={setDay}
                room={room}
                onRoom={setRoom}
                rooms={rooms}
              />

              {error && (
                <p className="rounded-[8px] bg-[#fc835e]/15 px-[12px] py-[8px] text-[14px] [overflow-wrap:anywhere] text-[#b4441f]">{error}</p>
              )}

              {viewMode === 'gallery' && (
                <div className="flex items-center gap-[16px]">
                  <SortButton label="Name" sortKey="name" sort={sort} onSort={onSort} />
                  <SortButton label="Date / Time" sortKey="date" sort={sort} onSort={onSort} />
                  <SortButton label="Slide" sortKey="slide" sort={sort} onSort={onSort} />
                  <span className="ml-auto text-[12px] text-ink-muted">
                    {slides.length} slide{slides.length === 1 ? '' : 's'}
                  </span>
                </div>
              )}

              {loading ? (
                <p className="py-[48px] text-center text-[14px] text-ink-muted">Loading slides…</p>
              ) : slides.length === 0 ? (
                <p className="py-[48px] text-center text-[14px] text-ink-muted">No slides match these filters.</p>
              ) : viewMode === 'gallery' ? (
                <GalleryView items={slides} selecting={selecting} selected={selected} actions={actions} />
              ) : (
                <ListView items={slides} selecting={selecting} selected={selected} actions={actions} sort={sort} onSort={onSort} />
              )}
            </div>
          )}
        </section>

        <div className="pointer-events-none absolute inset-x-0 bottom-[40px] flex flex-col items-center gap-[12px]">
          <Toast toast={toast} />
          {selecting && route.section === 'slides' && (
            <SelectionBar count={selected.size} busy={exporting} onDownload={downloadSelected} onClose={exitSelecting} />
          )}
        </div>
      </main>

      {passcodePrompt && (
        <PasscodeDialog
          error={passcodePrompt.error}
          onCancel={() => setPasscodePrompt(null)}
          onSubmit={(passcode) => {
            setAdminPasscode(passcode);
            setPasscodePrompt(null);
            void runBizzaboFetch(passcode);
          }}
        />
      )}

      {openItem && (
        <ItemOverlay
          item={openItem}
          onClose={() => setOpenId(null)}
          onCopy={actions.copy}
          onDownload={actions.download}
          onPrev={openIndex > 0 ? () => setOpenId(slides[openIndex - 1]!.id) : undefined}
          onNext={openIndex >= 0 && openIndex < slides.length - 1 ? () => setOpenId(slides[openIndex + 1]!.id) : undefined}
        />
      )}
      <TooltipLayer />
    </div>
  );
}
