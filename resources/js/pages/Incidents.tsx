import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { formatMoney } from '../lib/labels';
import { useOnline } from '../hooks/useSync';

interface IncidentRow {
    id: string;
    type: 'missing' | 'damaged';
    quantity: number;
    estimated_loss: string | null;
    status: string;
    description: string | null;
    item: { name: string } | null;
    shoot: { name: string } | null;
    responsible: { name: string } | null;
}

const typeLabels: Record<IncidentRow['type'], { label: string; className: string }> = {
    missing: { label: 'Faltante', className: 'bg-rose-100 text-rose-800' },
    damaged: { label: 'Dañado', className: 'bg-amber-100 text-amber-800' },
};

export default function Incidents() {
    const online = useOnline();
    const [incidents, setIncidents] = useState<IncidentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [onlyOpen, setOnlyOpen] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await api.get<{ data: IncidentRow[] }>('/incidents', {
                params: onlyOpen ? { status: 'open' } : {},
            });
            setIncidents(response.data.data);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setLoading(false);
        }
    }, [onlyOpen]);

    useEffect(() => {
        if (online) {
            void load();
        } else {
            setLoading(false);
        }
    }, [online, load]);

    async function resolve(id: string) {
        try {
            await api.put(`/incidents/${id}`, { status: 'resolved' });
            await load();
        } catch (caught) {
            setError(errorMessage(caught));
        }
    }

    if (!online) {
        return (
            <div className="p-4">
                <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">
                    Los faltantes se consultan con conexión. Esta pantalla es para la oficina.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Faltantes y daños</h2>
                <button
                    type="button"
                    onClick={() => setOnlyOpen((value) => !value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                    {onlyOpen ? 'Ver todos' : 'Solo abiertos'}
                </button>
            </div>

            {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

            {loading ? (
                <p className="text-sm text-slate-500">Cargando…</p>
            ) : incidents.length === 0 ? (
                <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">
                    No hay novedades registradas.
                </p>
            ) : (
                <ul className="space-y-2">
                    {incidents.map((incident) => {
                        const type = typeLabels[incident.type];

                        return (
                            <li key={incident.id} className="rounded-lg bg-white p-4 shadow-sm">
                                <div className="flex items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-slate-900">
                                            {incident.item?.name ?? 'Equipo'}
                                        </p>
                                        <p className="truncate text-xs text-slate-500">
                                            {incident.shoot?.name} · {incident.responsible?.name}
                                        </p>
                                    </div>
                                    <span
                                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${type.className}`}
                                    >
                                        {type.label}
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center gap-3 text-sm">
                                    <span className="font-semibold tabular-nums text-slate-900">
                                        {incident.quantity} und.
                                    </span>
                                    <span className="text-slate-500">{formatMoney(incident.estimated_loss)}</span>

                                    {incident.status === 'open' ? (
                                        <button
                                            type="button"
                                            onClick={() => void resolve(incident.id)}
                                            className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                        >
                                            Resolver
                                        </button>
                                    ) : (
                                        <span className="ml-auto text-xs font-medium text-emerald-600">
                                            Resuelto
                                        </span>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
