import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { formatDate, shootStatusLabels } from '../lib/labels';
import { useAuth } from '../lib/auth';
import { useOnline } from '../hooks/useSync';

export default function Shoots() {
    const { isAdmin } = useAuth();
    const online = useOnline();

    const shoots = useLiveQuery(
        async () => {
            const all = await db.shoots.toArray();

            return all.sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
        },
        [],
        [],
    );

    const itemCounts = useLiveQuery(
        async () => {
            const rows = await db.shootItems.toArray();

            return rows.reduce<Record<string, number>>((accumulator, row) => {
                accumulator[row.shoot_id] = (accumulator[row.shoot_id] ?? 0) + 1;

                return accumulator;
            }, {});
        },
        [],
        {} as Record<string, number>,
    );

    return (
        <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Rodajes</h2>
                {isAdmin && online && (
                    <Link
                        to="/rodajes/nuevo"
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                        Nuevo
                    </Link>
                )}
            </div>

            {shoots.length === 0 ? (
                <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">
                    No hay rodajes descargados. Conéctate y sincroniza para traerlos.
                </p>
            ) : (
                <ul className="space-y-2">
                    {shoots.map((shoot) => {
                        const status = shootStatusLabels[shoot.status];

                        return (
                            <li key={shoot.id}>
                                <Link
                                    to={`/rodajes/${shoot.id}`}
                                    className="block rounded-lg bg-white p-4 shadow-sm active:bg-slate-50"
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium text-slate-900">{shoot.name}</p>
                                            <p className="truncate text-sm text-slate-500">
                                                {shoot.location ?? 'Sin ubicación'}
                                            </p>
                                        </div>
                                        <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}
                                        >
                                            {status.label}
                                        </span>
                                    </div>

                                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                                        <span>{formatDate(shoot.scheduled_date)}</span>
                                        <span>·</span>
                                        <span>{itemCounts[shoot.id] ?? 0} equipos</span>
                                        {shoot.downloaded_at && (
                                            <span className="ml-auto font-medium text-emerald-600">
                                                Listo sin conexión
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
