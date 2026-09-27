import { useEffect, useState } from 'react';
import { dismissRejected, rejectedOperations } from '../lib/sync';
import type { SyncState } from '../hooks/useSync';
import type { QueuedOperation } from '../lib/db';

function relativeTime(iso: string | undefined): string {
    if (!iso) {
        return 'nunca';
    }

    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

    if (minutes < 1) {
        return 'hace un momento';
    }

    if (minutes < 60) {
        return `hace ${minutes} min`;
    }

    const hours = Math.round(minutes / 60);

    if (hours < 24) {
        return `hace ${hours} h`;
    }

    return `hace ${Math.round(hours / 24)} d`;
}

export default function SyncBar({ state }: { state: SyncState }) {
    const { online, pending, rejected, lastPull, syncing, sync } = state;
    const [details, setDetails] = useState<QueuedOperation[]>([]);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        if (rejected > 0) {
            void rejectedOperations().then(setDetails);
        } else {
            setDetails([]);
            setShowDetails(false);
        }
    }, [rejected]);

    return (
        <div className="sticky top-0 z-20">
            <div
                className={`flex items-center gap-3 px-4 py-2 text-sm ${
                    online ? 'bg-slate-800 text-slate-200' : 'bg-amber-500 text-amber-950'
                }`}
            >
                <span
                    className={`size-2 shrink-0 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-900'}`}
                    aria-hidden
                />

                <div className="min-w-0 flex-1 leading-tight">
                    {online ? (
                        <>
                            <span className="font-medium">En línea</span>
                            <span className="ml-2 text-slate-400">
                                Actualizado {relativeTime(lastPull)}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="font-medium">Sin conexión</span>
                            <span className="ml-2">
                                {pending > 0
                                    ? `${pending} cambio${pending === 1 ? '' : 's'} guardado${pending === 1 ? '' : 's'} en el celular`
                                    : 'Trabajando con los datos descargados'}
                            </span>
                        </>
                    )}
                </div>

                {pending > 0 && (
                    <span className="shrink-0 rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold tabular-nums">
                        {pending} pendiente{pending === 1 ? '' : 's'}
                    </span>
                )}

                {online && (
                    <button
                        type="button"
                        onClick={() => void sync()}
                        disabled={syncing}
                        className="shrink-0 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
                    >
                        {syncing ? 'Sincronizando…' : 'Sincronizar'}
                    </button>
                )}
            </div>

            {rejected > 0 && (
                <div className="bg-rose-600 px-4 py-2 text-sm text-white">
                    <div className="flex items-center gap-3">
                        <span className="flex-1">
                            El servidor rechazó {rejected} cambio{rejected === 1 ? '' : 's'}.
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowDetails((value) => !value)}
                            className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold"
                        >
                            {showDetails ? 'Ocultar' : 'Ver'}
                        </button>
                        <button
                            type="button"
                            onClick={() => void dismissRejected()}
                            className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold"
                        >
                            Entendido
                        </button>
                    </div>

                    {showDetails && (
                        <ul className="mt-2 space-y-1 text-xs">
                            {details.map((operation) => (
                                <li key={operation.id} className="rounded bg-black/20 px-2 py-1">
                                    <span className="font-semibold">{operation.entity}</span>:{' '}
                                    {operation.message ?? operation.result}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
