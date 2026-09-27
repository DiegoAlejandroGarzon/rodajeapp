import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { formatMoney } from '../lib/labels';
import { useOnline } from '../hooks/useSync';

interface Summary {
    items_total: number;
    items_needing_review: number;
    shoots_in_field: number;
    shoots_pending_close: number;
    incidents_open: number;
    estimated_loss_open: number;
}

interface ResponsibleRow {
    user_id: number;
    user_name: string;
    shoots_completed: number;
    incidents_total: number;
    units_missing: number;
    units_damaged: number;
    estimated_loss: number;
    incidents_per_shoot: number | null;
}

interface OverdueShoot {
    id: string;
    name: string;
    expected_return_date: string | null;
    responsible: { name: string } | null;
}

export default function Reports() {
    const online = useOnline();
    const [summary, setSummary] = useState<Summary | null>(null);
    const [byResponsible, setByResponsible] = useState<ResponsibleRow[]>([]);
    const [overdue, setOverdue] = useState<OverdueShoot[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!online) {
            setLoading(false);

            return;
        }

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const [summaryResponse, responsibleResponse, overdueResponse] = await Promise.all([
                    api.get<Summary>('/reports/summary'),
                    api.get<{ data: ResponsibleRow[] }>('/reports/by-responsible'),
                    api.get<{ data: OverdueShoot[] }>('/reports/overdue-shoots'),
                ]);

                setSummary(summaryResponse.data);
                setByResponsible(responsibleResponse.data.data);
                setOverdue(overdueResponse.data.data);
            } catch (caught) {
                setError(errorMessage(caught));
            } finally {
                setLoading(false);
            }
        }

        void load();
    }, [online]);

    if (!online) {
        return (
            <div className="p-4">
                <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">
                    Los reportes se consultan con conexión.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Reportes</h2>

            {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

            {loading ? (
                <p className="text-sm text-slate-500">Cargando…</p>
            ) : (
                <>
                    {summary && (
                        <div className="grid grid-cols-2 gap-2">
                            <Stat label="Equipos" value={summary.items_total} />
                            <Stat label="En rodaje" value={summary.shoots_in_field} />
                            <Stat label="Faltantes abiertos" value={summary.incidents_open} tone="danger" />
                            <Stat label="Por cerrar" value={summary.shoots_pending_close} />
                            <div className="col-span-2 rounded-lg bg-white p-4 shadow-sm">
                                <p className="text-xs text-slate-500">Pérdida estimada sin resolver</p>
                                <p className="text-xl font-semibold text-rose-600">
                                    {formatMoney(summary.estimated_loss_open)}
                                </p>
                            </div>
                        </div>
                    )}

                    {overdue.length > 0 && (
                        <section className="mt-5">
                            <h3 className="mb-2 text-sm font-semibold text-rose-800">
                                Sin descargue después de la fecha de retorno
                            </h3>
                            <ul className="space-y-2">
                                {overdue.map((shoot) => (
                                    <li key={shoot.id} className="rounded-lg bg-rose-50 p-3 ring-1 ring-rose-200">
                                        <p className="text-sm font-medium text-rose-900">{shoot.name}</p>
                                        <p className="text-xs text-rose-700">
                                            Responsable: {shoot.responsible?.name ?? '—'} · debía volver el{' '}
                                            {shoot.expected_return_date}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section className="mt-5">
                        <h3 className="mb-2 text-sm font-semibold text-slate-800">Novedades por responsable</h3>

                        {byResponsible.length === 0 ? (
                            <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">
                                Todavía no hay novedades registradas.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {byResponsible.map((row) => (
                                    <li key={row.user_id} className="rounded-lg bg-white p-4 shadow-sm">
                                        <div className="flex items-baseline gap-2">
                                            <p className="min-w-0 flex-1 truncate font-medium text-slate-900">
                                                {row.user_name}
                                            </p>
                                            <span className="shrink-0 text-sm text-slate-500">
                                                {row.shoots_completed} rodaje{row.shoots_completed === 1 ? '' : 's'}
                                            </span>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                                            <span>
                                                Faltantes:{' '}
                                                <strong className="tabular-nums text-rose-600">
                                                    {row.units_missing}
                                                </strong>
                                            </span>
                                            <span>
                                                Dañados:{' '}
                                                <strong className="tabular-nums text-amber-600">
                                                    {row.units_damaged}
                                                </strong>
                                            </span>
                                            {row.incidents_per_shoot !== null && (
                                                <span>
                                                    Por rodaje:{' '}
                                                    <strong className="tabular-nums">
                                                        {row.incidents_per_shoot}
                                                    </strong>
                                                </span>
                                            )}
                                            <span className="ml-auto font-semibold text-slate-900">
                                                {formatMoney(row.estimated_loss)}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
    return (
        <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{label}</p>
            <p
                className={`text-xl font-semibold tabular-nums ${
                    tone === 'danger' && value > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
            >
                {value}
            </p>
        </div>
    );
}
