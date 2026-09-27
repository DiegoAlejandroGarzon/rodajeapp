import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { api, errorMessage } from '../lib/api';
import { db } from '../lib/db';
import { formatMoney } from '../lib/labels';
import { pullBootstrap } from '../lib/sync';
import { useOnline } from '../hooks/useSync';
import { useAuth } from '../lib/auth';

export default function Inventory() {
    const online = useOnline();
    const { isAdmin } = useAuth();
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const categories = useLiveQuery(
        async () => new Map((await db.categories.toArray()).map((row) => [row.id, row])),
        [],
        new Map(),
    );

    const items = useLiveQuery(
        async () => {
            const all = await db.items.toArray();
            const term = search.trim().toLowerCase();

            return all
                .filter(
                    (item) =>
                        term === '' ||
                        item.name.toLowerCase().includes(term) ||
                        (item.code ?? '').toLowerCase().includes(term),
                )
                .sort((a, b) => a.name.localeCompare(b.name));
        },
        [search],
        [],
    );

    const needingReview = items.filter((item) => item.needs_review);

    async function approve(itemId: string) {
        setBusy(true);
        setMessage(null);

        try {
            await api.post(`/items/${itemId}/approve`);
            await pullBootstrap();
        } catch (error) {
            setMessage(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="p-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Inventario</h2>

            <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar equipo o código"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none"
            />

            {message && (
                <p className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">{message}</p>
            )}

            {isAdmin && needingReview.length > 0 && online && (
                <section className="mt-4">
                    <h3 className="mb-2 text-sm font-semibold text-amber-800">
                        Creados en locación ({needingReview.length})
                    </h3>
                    <ul className="space-y-2">
                        {needingReview.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200"
                            >
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-amber-900">
                                    {item.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void approve(item.id)}
                                    disabled={busy}
                                    className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                    Aprobar
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <ul className="mt-4 space-y-2">
                {items.map((item) => (
                    <li key={item.id} className="rounded-lg bg-white p-3 shadow-sm">
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-slate-900">{item.name}</p>
                                <p className="truncate text-xs text-slate-500">
                                    {categories.get(item.category_id ?? '')?.name ?? 'Sin categoría'}
                                    {item.code ? ` · ${item.code}` : ''}
                                </p>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="font-semibold tabular-nums text-slate-900">{item.quantity}</p>
                                <p className="text-xs text-slate-500">{formatMoney(item.reference_value)}</p>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            {items.length === 0 && (
                <p className="mt-4 rounded-lg bg-white p-6 text-center text-sm text-slate-500">
                    {search ? 'Ningún equipo coincide.' : 'No hay equipos descargados. Sincroniza con señal.'}
                </p>
            )}
        </div>
    );
}
