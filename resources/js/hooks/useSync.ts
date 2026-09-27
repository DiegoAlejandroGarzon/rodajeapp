import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { lastPullAt, pendingCount, pruneSyncedOperations, syncNow, type SyncNowResult } from '../lib/sync';

export function useOnline(): boolean {
    const [online, setOnline] = useState(() => navigator.onLine);

    useEffect(() => {
        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return online;
}

export interface SyncState {
    online: boolean;
    pending: number;
    rejected: number;
    lastPull: string | undefined;
    syncing: boolean;
    lastResult: SyncNowResult | null;
    sync: () => Promise<SyncNowResult>;
}

export function useSync(): SyncState {
    const online = useOnline();
    const [syncing, setSyncing] = useState(false);
    const [lastResult, setLastResult] = useState<SyncNowResult | null>(null);
    const [lastPull, setLastPull] = useState<string | undefined>(undefined);

    const pending = useLiveQuery(() => pendingCount(), [], 0);

    const rejected = useLiveQuery(
        () =>
            db.queue
                .filter(
                    (operation) =>
                        operation.synced_at !== undefined &&
                        operation.result !== undefined &&
                        operation.result !== 'applied',
                )
                .count(),
        [],
        0,
    );

    const refreshLastPull = useCallback(async () => {
        setLastPull(await lastPullAt());
    }, []);

    useEffect(() => {
        void refreshLastPull();
    }, [refreshLastPull]);

    const sync = useCallback(async () => {
        setSyncing(true);

        try {
            const result = await syncNow();
            setLastResult(result);

            if (result.ok) {
                await pruneSyncedOperations();
                await refreshLastPull();
            }

            return result;
        } finally {
            setSyncing(false);
        }
    }, [refreshLastPull]);

    // Al recuperar señal sincronizamos solo: en iOS no se puede confiar en
    // Background Sync, así que el disparador es volver a tener red con la app abierta.
    useEffect(() => {
        if (online && pending > 0 && !syncing) {
            void sync();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [online]);

    return { online, pending, rejected, lastPull, syncing, lastResult, sync };
}
