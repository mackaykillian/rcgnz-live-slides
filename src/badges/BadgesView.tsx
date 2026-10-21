import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowsClockwise, CardsThree, FilePng, MagnifyingGlass, Warning, X } from '@phosphor-icons/react';
import { BADGE_TYPES, type BadgeRegistration, type BadgeStatus } from '../../shared/badges';
import { AdminAuthError, fetchBadges, generateBadges, previewBadgePng } from '../data/admin';
import { Dropdown } from '../ui/Filters';
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

const fullName = (r: BadgeRegistration) => (r.data ? `${r.data.firstName} ${r.data.lastName}`.trim() : `Registration ${r.registrationId ?? r.recordId}`);

interface Props {
  passcode: string | null;
  /** Ask for the admin passcode (again, with `error` after a rejected one). */
  onNeedPasscode: (error: string | null) => void;
  notify: (kind: ToastKind, message: string) => void;
}

/**
 * Admin-only badge console: every registration rendered with the live badge
 * template, its status in Airtable, and actions to (re)generate the print PNGs.
 * New registrations and changed details are also handled by the 15-minute cron.
 */
export function BadgesView({ passcode, onNeedPasscode, notify }: Props) {
  const [registrations, setRegistrations] = useState<BadgeRegistration[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const stopRef = useRef(false);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<BadgeStatus | 'all'>('all');

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
        const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.recordId));
        ok += succeeded.size;
        failures.push(...results.filter((r) => !r.ok).map((r) => r.error ?? 'Unknown error'));
        setRegistrations((prev) =>
          prev?.map((r) => (succeeded.has(r.recordId) ? { ...r, status: 'current', reason: undefined } : r)) ?? prev,
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
      setRegistrations((prev) => prev?.map((x) => (x.recordId === r.recordId ? { ...x, status: 'current', reason: undefined } : x)) ?? prev);
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
    notify('busy', 'Rendering print PNG…');
    try {
      const url = URL.createObjectURL(await previewBadgePng(passcode, r.recordId));
      if (tab) tab.location.href = url;
      else window.location.href = url;
      notify('success', 'Preview opened — not uploaded');
    } catch (err) {
      tab?.close();
      handleError(err);
    }
  };

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
  }, [registrations, search, type, status]);

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

  return (
    <div className="flex flex-col gap-[16px] pb-[72px]">
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <p className="text-[12px] leading-[1.5] text-ink-muted">
          Print PNGs (3.5″ × 5.5″ + bleed, 300 DPI) are saved to each registration’s <b>Badge</b> and <b>QR Code</b> fields in Airtable.
          New registrations and changed details are generated automatically every 15 minutes.
        </p>
        <div className="flex items-center gap-[8px]">
          {running ? (
            <>
              <span className="text-[12px] text-ink-muted" role="status">
                Generating {progress.done} / {progress.total}…
              </span>
              <button
                type="button"
                onClick={() => (stopRef.current = true)}
                className={`rounded-[8px] bg-overlay-subtle px-[12px] py-[8px] text-[14px] leading-[1.5] hover:brightness-95 ${focusRing}`}
              >
                Stop
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!validIds.length}
                onClick={() => {
                  if (window.confirm(`Regenerate all ${validIds.length} badges? This replaces every Badge and QR Code file in Airtable.`)) {
                    void run(validIds);
                  }
                }}
                className={`rounded-[8px] bg-overlay-subtle px-[12px] py-[8px] text-[14px] leading-[1.5] hover:brightness-95 disabled:opacity-50 ${focusRing}`}
              >
                Regenerate all
              </button>
              <button
                type="button"
                disabled={!pendingIds.length}
                onClick={() => void run(pendingIds)}
                className={`flex items-center gap-[6px] rounded-[8px] bg-accent px-[12px] py-[8px] text-[14px] leading-[1.5] text-white hover:bg-[#1f5fe0] disabled:opacity-50 ${focusRing}`}
              >
                <ArrowsClockwise size={16} />
                Generate {pendingIds.length || ''} pending
              </button>
            </>
          )}
        </div>
      </div>

      {running && (
        <div className="h-[4px] overflow-hidden rounded-full bg-overlay-subtle" aria-hidden>
          <div className="h-full bg-accent transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
      )}

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

      <div className="flex flex-wrap items-center gap-[8px]">
        <label className="flex max-w-[480px] min-w-[200px] flex-1 items-center gap-[8px] rounded-[8px] bg-overlay-subtle px-[12px] py-[8px] focus-within:ring-2 focus-within:ring-accent/40">
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
      </div>

      {error && <p className="rounded-[8px] bg-[#fc835e]/15 px-[12px] py-[8px] text-[14px] [overflow-wrap:anywhere] text-[#b4441f]">{error}</p>}

      {!registrations ? (
        <p className="py-[48px] text-center text-[14px] text-ink-muted">{loading ? 'Loading registrations…' : ''}</p>
      ) : shown.length === 0 ? (
        <p className="py-[48px] text-center text-[14px] text-ink-muted">No registrations match these filters.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(267px,1fr))] gap-x-[24px] gap-y-[32px]">
          {shown.map((r) => {
            const busy = busyIds.has(r.recordId);
            const chip = STATUS_CHIP[r.status];
            return (
              <li key={r.recordId} className="flex flex-col items-center gap-[10px]">
                {r.data ? (
                  <div className="shadow-[0_2px_12px_rgba(2,14,30,0.12)] ring-1 ring-ink/5">
                    <BadgeCard data={r.data} />
                  </div>
                ) : (
                  <div className="flex h-[414px] w-[267px] items-center justify-center bg-overlay-subtle p-[24px] text-center text-[12px] text-ink-muted">
                    {r.reason}
                  </div>
                )}
                <div className="flex w-[267px] items-start justify-between gap-[8px]">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] leading-[1.4]">{fullName(r)}</p>
                    <p className="truncate text-[12px] leading-[1.4] text-ink-muted">
                      #{r.registrationId ?? '—'} · {r.data?.type ?? 'No badge type'}
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
                {r.data && (
                  <div className="flex w-[267px] gap-[8px]">
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
                      data-tooltip="Render the print PNG without uploading it"
                      className={`flex items-center justify-center gap-[6px] rounded-[8px] bg-overlay-subtle px-[8px] py-[6px] text-[12px] leading-[1.5] hover:brightness-95 ${focusRing}`}
                    >
                      <FilePng size={14} />
                      Preview PNG
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
