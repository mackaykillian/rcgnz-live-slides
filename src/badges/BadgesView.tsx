import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowsClockwise, CardsThree, CheckCircle, FilePdf, MagnifyingGlass, Stack, Warning, X } from '@phosphor-icons/react';
import { BADGE_TYPES, MAX_BADGES_PER_BATCH, PAGE_HEIGHT, PAGE_WIDTH, type BadgeRegistration, type BadgeStatus } from '../../shared/badges';
import { AdminAuthError, downloadBadgesPdf, fetchBadges, generateBadges, previewBadgePdf } from '../data/admin';
import { Dropdown } from '../ui/Filters';
import { SelectionBar } from '../ui/SelectionBar';
import type { ToastKind } from '../ui/Toast';
import { BadgeCard } from './BadgeCard';

/** Matches MAX_BATCH in worker/badges/index.ts. */
const BATCH_SIZE = 10;

const STATUS_TABS: { value: BadgeStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'To generate' },
  { value: 'current', label: 'Up to date' },
  { value: 'invalid', label: 'Problems' },
];

const STATUS_CHIP: Record<BadgeStatus, { label: string; background: string }> = {
  current: { label: 'Up to date', background: 'rgb(168 243 155 / 0.35)' },
  pending: { label: 'To generate', background: 'rgb(255 234 100 / 0.45)' },
  invalid: { label: 'Problem', background: 'rgb(248 106 106 / 0.25)' },
};

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent';
/** Header buttons — same look as the Slides "Select" button. */
const headerButton = `flex items-center gap-[6px] rounded-[8px] px-[12px] py-[8px] text-[14px] leading-[1.5] disabled:opacity-50 ${focusRing}`;

/** Batch filter value for registrations without a Batch in Airtable. */
const NO_BATCH = '__none';

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const generatedFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const fullName = (r: BadgeRegistration) => (r.data ? `${r.data.firstName} ${r.data.lastName}`.trim() : `Registration ${r.registrationId ?? r.recordId}`);

const sameSet = (a: Set<string>, b: string[]) => a.size === b.length && b.every((id) => a.has(id));

interface Props {
  passcode: string | null;
  /** Ask for the admin passcode (again, with `error` after a rejected one). */
  onNeedPasscode: (error: string | null) => void;
  notify: (kind: ToastKind, message: string) => void;
  /** Where to render the header buttons (next to the "Badges" title). */
  headerSlot: HTMLElement | null;
  /** Where to render the selection pill (bottom of the view). */
  bottomSlot: HTMLElement | null;
}

/**
 * Admin-only badge console: every registration rendered with the live badge
 * template, its status in Airtable, and actions to (re)generate the print PDFs.
 * New registrations and changed details are also handled by the 15-minute cron.
 *
 * Select mode builds one printer PDF: the selection survives filter changes, and
 * "Select all" adds whatever the filters show — so "all of Batch 1" is the Batch
 * filter + Select all.
 */
export function BadgesView({ passcode, onNeedPasscode, notify, headerSlot, bottomSlot }: Props) {
  const [registrations, setRegistrations] = useState<BadgeRegistration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const stopRef = useRef(false);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [batch, setBatch] = useState('');
  const [status, setStatus] = useState<BadgeStatus | 'all'>('all');

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof AdminAuthError) onNeedPasscode(err.message);
      else notify('error', (err as Error).message);
    },
    [notify, onNeedPasscode],
  );

  const load = useCallback(async () => {
    if (!passcode) return;
    setLoading(true);
    setError(null);
    try {
      setRegistrations(await fetchBadges(passcode));
    } catch (err) {
      if (err instanceof AdminAuthError) onNeedPasscode(err.message);
      else setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [passcode, onNeedPasscode]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Generate in batches; the list updates as each batch lands. */
  const run = async (recordIds: string[]) => {
    if (!passcode || !recordIds.length) return;
    stopRef.current = false;
    setProgress({ done: 0, total: recordIds.length });
    let ok = 0;
    const failures: string[] = [];
    try {
      for (let i = 0; i < recordIds.length && !stopRef.current; i += BATCH_SIZE) {
        const results = await generateBadges(passcode, recordIds.slice(i, i + BATCH_SIZE));
        const succeeded = new Map(results.filter((r) => r.ok).map((r) => [r.recordId, r.generatedAt ?? null]));
        ok += succeeded.size;
        failures.push(...results.filter((r) => !r.ok).map((r) => r.error ?? 'Unknown error'));
        setRegistrations(
          (prev) =>
            prev?.map((r) =>
              succeeded.has(r.recordId)
                ? { ...r, status: 'current', reason: undefined, generatedAt: succeeded.get(r.recordId) ?? r.generatedAt }
                : r,
            ) ?? prev,
        );
        setProgress({ done: Math.min(i + BATCH_SIZE, recordIds.length), total: recordIds.length });
      }
      if (failures.length) notify('error', `${ok} generated, ${failures.length} failed: ${[...new Set(failures)].join('; ')}`);
      else notify('success', `${ok} badge${ok === 1 ? '' : 's'} generated and uploaded to Airtable`);
    } catch (err) {
      handleError(err);
    } finally {
      setProgress(null);
      void load();
    }
  };

  const regenerateOne = async (r: BadgeRegistration) => {
    if (!passcode) return;
    setBusyIds((s) => new Set(s).add(r.recordId));
    try {
      const [result] = await generateBadges(passcode, [r.recordId]);
      if (!result?.ok) throw new Error(result?.error ?? 'Badge failed');
      setRegistrations(
        (prev) =>
          prev?.map((x) =>
            x.recordId === r.recordId
              ? { ...x, status: 'current', reason: undefined, generatedAt: result.generatedAt ?? x.generatedAt }
              : x,
          ) ?? prev,
      );
      notify('success', `Badge for ${fullName(r)} uploaded to Airtable`);
    } catch (err) {
      handleError(err);
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(r.recordId);
        return next;
      });
    }
  };

  const preview = async (r: BadgeRegistration) => {
    if (!passcode) return;
    // Open the tab inside the click so it isn't blocked as a popup.
    const tab = window.open('', '_blank');
    notify('busy', 'Rendering print PDF…');
    try {
      const url = URL.createObjectURL(await previewBadgePdf(passcode, r.recordId));
      if (tab) tab.location.href = url;
      else window.location.href = url;
      notify('success', 'Preview opened — not uploaded');
    } catch (err) {
      tab?.close();
      handleError(err);
    }
  };

  /** Printable badges per Batch (registrations with problems aren't printed). */
  const batches = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of registrations ?? []) if (r.batch && r.data) m.set(r.batch, [...(m.get(r.batch) ?? []), r.recordId]);
    return [...m].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [registrations]);
  const unbatched = (registrations ?? []).filter((r) => !r.batch).length;

  const counts = useMemo(() => {
    const c: Record<BadgeStatus | 'all', number> = { all: 0, pending: 0, current: 0, invalid: 0 };
    for (const r of registrations ?? []) {
      c.all++;
      c[r.status]++;
    }
    return c;
  }, [registrations]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (registrations ?? [])
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => !type || r.data?.type === type)
      .filter((r) => !batch || (batch === NO_BATCH ? !r.batch : r.batch === batch))
      .filter(
        (r) =>
          !q ||
          [fullName(r), r.data?.company, String(r.registrationId ?? '')].some((v) => v?.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          (a.data?.lastName ?? '').localeCompare(b.data?.lastName ?? '') ||
          (a.data?.firstName ?? '').localeCompare(b.data?.firstName ?? ''),
      );
  }, [registrations, search, type, batch, status]);

  // ---- Selection ------------------------------------------------------------

  /** Only printable badges can be selected. */
  const selectableShown = useMemo(() => shown.filter((r) => r.data).map((r) => r.recordId), [shown]);
  const allShownSelected = selectableShown.length > 0 && selectableShown.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllShown = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of selectableShown) {
        if (allShownSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  const exitSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  /** "Batch 1" when the selection is exactly one batch; otherwise "Selection". */
  const selectionLabel = batches.find(([, ids]) => sameSet(selected, ids))?.[0] ?? 'Selection';

  const downloadSelected = async () => {
    if (!passcode || !selected.size) return;
    setDownloading(true);
    notify('busy', `Rendering ${selected.size} badge${selected.size === 1 ? '' : 's'}…`);
    try {
      const blob = await downloadBadgesPdf(passcode, [...selected], selectionLabel);
      saveBlob(blob, `RCGNZ-Badges_${selectionLabel.replace(/[^\p{L}\p{N}]+/gu, '') || 'Selection'}_${selected.size}.pdf`);
      notify('success', `Downloaded ${selected.size} badge${selected.size === 1 ? '' : 's'}`);
    } catch (err) {
      handleError(err);
    } finally {
      setDownloading(false);
    }
  };

  if (!passcode) {
    return (
      <div className="flex flex-col items-center gap-[12px] py-[48px] text-center">
        <p className="text-[14px] text-ink-muted">Badges are admin only.</p>
        <button
          type="button"
          onClick={() => onNeedPasscode(null)}
          className={`rounded-[8px] bg-accent px-[12px] py-[8px] text-[14px] leading-[1.5] text-white hover:bg-[#1f5fe0] ${focusRing}`}
        >
          Enter admin passcode
        </button>
      </div>
    );
  }

  const running = !!progress;
  const pendingIds = (registrations ?? []).filter((r) => r.status === 'pending').map((r) => r.recordId);
  const validIds = (registrations ?? []).filter((r) => r.data).map((r) => r.recordId);
  const problems = (registrations ?? []).filter((r) => r.status === 'invalid');

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
        aria-pressed={selecting}
        disabled={running}
        className={`${headerButton} ${selecting ? 'bg-accent text-white' : 'bg-white text-ink hover:bg-white/70'}`}
      >
        <CheckCircle size={16} />
        Select
      </button>
      {running ? (
        <>
          <span className="px-[4px] text-[14px] text-ink-muted" role="status">
            Generating {progress.done} / {progress.total}…
          </span>
          <button type="button" onClick={() => (stopRef.current = true)} className={`${headerButton} bg-white text-ink hover:bg-white/70`}>
            Stop
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={selecting || !pendingIds.length}
            onClick={() => void run(pendingIds)}
            className={`${headerButton} bg-accent text-white hover:bg-[#1f5fe0] disabled:hover:bg-accent`}
          >
            <ArrowsClockwise size={16} />
            Generate pending{pendingIds.length ? ` (${pendingIds.length})` : ''}
          </button>
          <button
            type="button"
            disabled={selecting || !validIds.length}
            onClick={() => {
              if (window.confirm(`Regenerate all ${validIds.length} badges? This replaces every Badge and QR Code file in Airtable.`)) {
                void run(validIds);
              }
            }}
            className={`${headerButton} bg-white text-ink hover:bg-white/70 disabled:hover:bg-white`}
          >
            Regenerate all
          </button>
        </>
      )}
    </>
  );

  const overLimit = selected.size > MAX_BADGES_PER_BATCH;
  const selectionBar = selecting && (
    <SelectionBar
      count={selected.size}
      busy={downloading}
      onDownload={() => void downloadSelected()}
      onClose={exitSelecting}
      downloadLabel="Download as PDF"
      blockedReason={overLimit ? `Printer limit is ${MAX_BADGES_PER_BATCH}` : null}
    >
      <div className="flex items-center gap-[16px] text-[12px] leading-[1.5] whitespace-nowrap text-white">
        <button type="button" onClick={toggleAllShown} disabled={!selectableShown.length} className="hover:text-white/70 disabled:opacity-50">
          {allShownSelected ? `Deselect ${selectableShown.length} shown` : `Select all ${selectableShown.length}`}
        </button>
        {selected.size > 0 && (
          <button type="button" onClick={() => setSelected(new Set())} className="text-white/70 hover:text-white">
            Clear
          </button>
        )}
      </div>
    </SelectionBar>
  );

  return (
    <div className="flex flex-col gap-[16px] pb-[96px]">
      {headerSlot && createPortal(headerActions, headerSlot)}
      {bottomSlot && selectionBar && createPortal(selectionBar, bottomSlot)}

      {running && (
        <div className="h-[4px] overflow-hidden rounded-full bg-overlay-subtle" aria-hidden>
          <div className="h-full bg-accent transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-[8px]">
        <label className="flex max-w-[600px] min-w-[200px] flex-1 items-center gap-[8px] rounded-[8px] bg-overlay-subtle px-[12px] py-[8px] focus-within:ring-2 focus-within:ring-accent/40">
          <MagnifyingGlass size={16} className="shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company or registration ID"
            className="min-w-0 flex-1 bg-transparent text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink/45 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>
        <Dropdown
          icon={<CardsThree size={16} />}
          label="Badge type"
          value={type}
          options={BADGE_TYPES.map((t) => ({ value: t, label: t }))}
          onChange={setType}
        />
        <Dropdown
          icon={<Stack size={16} />}
          label="Batch"
          value={batch}
          options={[
            ...batches.map(([name, ids]) => ({ value: name, label: `${name} (${ids.length})` })),
            { value: NO_BATCH, label: `No batch (${unbatched})` },
          ]}
          onChange={setBatch}
        />
      </div>

      <div role="tablist" aria-label="Badge status" className="flex gap-[4px]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-[6px] px-[10px] py-[6px] text-[14px] leading-[20px] ${focusRing} ${
              status === tab.value ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-overlay-subtle hover:text-ink'
            }`}
          >
            {tab.label}
            <span className="ml-[6px] text-[12px] opacity-60">{counts[tab.value]}</span>
          </button>
        ))}
      </div>

      {problems.length > 0 && (
        <div role="status" className="flex items-start gap-[8px] rounded-[8px] bg-[#fbbf24]/15 px-[12px] py-[8px] text-[12px] leading-[1.5]">
          <Warning size={16} weight="fill" className="mt-[1px] shrink-0 text-[#d97706]" />
          <p className="min-w-0 [overflow-wrap:anywhere]">
            {problems.length} registration{problems.length === 1 ? ' can’t get a badge' : 's can’t get badges'}:{' '}
            {problems.map((r, i) => (
              <span key={r.recordId}>
                {i > 0 && ', '}#{r.registrationId ?? r.recordId} ({r.reason})
              </span>
            ))}
          </p>
        </div>
      )}

      {error && <p className="rounded-[8px] bg-[#fc835e]/15 px-[12px] py-[8px] text-[14px] [overflow-wrap:anywhere] text-[#b4441f]">{error}</p>}

      {!registrations ? (
        <p className="py-[48px] text-center text-[14px] text-ink-muted">{loading ? 'Loading registrations…' : ''}</p>
      ) : shown.length === 0 ? (
        <p className="py-[48px] text-center text-[14px] text-ink-muted">No registrations match these filters.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(294px,1fr))] gap-x-[24px] gap-y-[32px]">
          {shown.map((r) => {
            const busy = busyIds.has(r.recordId);
            const chip = STATUS_CHIP[r.status];
            const isSelected = selected.has(r.recordId);
            const selectable = selecting && !!r.data;
            return (
              <li key={r.recordId} className="flex flex-col items-center gap-[10px]">
                {r.data ? (
                  <button
                    type="button"
                    disabled={!selecting}
                    onClick={() => toggle(r.recordId)}
                    aria-pressed={selecting ? isSelected : undefined}
                    aria-label={selecting ? `Select ${fullName(r)}` : undefined}
                    className={`relative block rounded-[2px] text-left ring-1 ring-ink/5 shadow-[0_2px_12px_rgba(2,14,30,0.12)] disabled:cursor-default ${
                      selectable ? `cursor-pointer ${isSelected ? 'ring-[3px] ring-accent' : 'hover:ring-2 hover:ring-accent/50'}` : ''
                    } ${focusRing}`}
                  >
                    <BadgeCard data={r.data} />
                    {selecting && (
                      <CheckCircle
                        size={28}
                        weight="fill"
                        className={`absolute top-[8px] left-[8px] ${isSelected ? 'text-accent' : 'text-ink/15'}`}
                      />
                    )}
                  </button>
                ) : (
                  <div
                    className="flex items-center justify-center bg-overlay-subtle p-[24px] text-center text-[12px] text-ink-muted"
                    style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
                  >
                    {r.reason}
                  </div>
                )}
                <div className="flex items-start justify-between gap-[8px]" style={{ width: PAGE_WIDTH }}>
                  <div className="flex min-w-0 flex-col gap-[2px]">
                    <p className="truncate text-[14px] leading-[1.4]">{fullName(r)}</p>
                    <p className="truncate text-[12px] leading-[1.4] text-ink-muted">
                      #{r.registrationId ?? '—'} · {r.data?.type ?? 'No badge type'}
                    </p>
                    <p className="truncate text-[12px] leading-[1.4] text-ink-muted">
                      {r.generatedAt ? `Generated ${generatedFormat.format(new Date(r.generatedAt))}` : 'Never generated'}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-[4px] px-[6px] py-[2px] text-[12px] leading-[1.4]"
                    style={{ background: chip.background }}
                    data-tooltip={r.reason}
                  >
                    {chip.label}
                  </span>
                </div>
                {r.data && !selecting && (
                  <div className="flex gap-[8px]" style={{ width: PAGE_WIDTH }}>
                    <button
                      type="button"
                      disabled={busy || running}
                      onClick={() => void regenerateOne(r)}
                      className={`flex flex-1 items-center justify-center gap-[6px] rounded-[8px] bg-overlay-subtle px-[8px] py-[6px] text-[12px] leading-[1.5] hover:brightness-95 disabled:opacity-50 ${focusRing}`}
                    >
                      <ArrowsClockwise size={14} className={busy ? 'animate-spin' : ''} />
                      {busy ? 'Generating…' : r.status === 'current' ? 'Regenerate' : 'Generate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void preview(r)}
                      data-tooltip="Render the print PDF without uploading it"
                      className={`flex flex-1 items-center justify-center gap-[6px] rounded-[8px] bg-overlay-subtle px-[8px] py-[6px] text-[12px] leading-[1.5] hover:brightness-95 ${focusRing}`}
                    >
                      <FilePdf size={14} />
                      Preview PDF
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
