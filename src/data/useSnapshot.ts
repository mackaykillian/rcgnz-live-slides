import { useCallback, useEffect, useState } from 'react';
import type { Snapshot, SyncResponse } from '../../shared/types';
import { SNAPSHOT_REFRESH_MS } from '../config';

interface State {
  snapshot: Snapshot | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;
}

/**
 * The latest synced snapshot from the Worker. Re-reads it periodically and when
 * the tab regains focus so scheduled syncs show up without a reload.
 */
export function useSnapshot() {
  const [state, setState] = useState<State>({ snapshot: null, loading: true, syncing: false, error: null });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/snapshot');
      if (!res.ok) throw new Error(`Couldn't load slides (${res.status})`);
      const snapshot = (await res.json()) as Snapshot;
      setState((s) => ({ ...s, snapshot, loading: false, error: null }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, []);

  const sync = useCallback(async () => {
    setState((s) => ({ ...s, syncing: true }));
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const body = (await res.json()) as SyncResponse;
      if (!body.ok || !body.snapshot) throw new Error(body.error ?? 'Sync failed');
      setState((s) => ({ ...s, snapshot: body.snapshot!, syncing: false, error: null }));
      return true;
    } catch (err) {
      setState((s) => ({ ...s, syncing: false, error: (err as Error).message }));
      return false;
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, SNAPSHOT_REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  return { ...state, sync };
}
