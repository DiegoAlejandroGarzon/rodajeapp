import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { db, type ShootItem } from '../lib/db';
import { formatDate, shootStatusLabels } from '../lib/labels';
import { addAdhocItemToShoot, downloadShootForOffline, updateShootItemLocally, updateShootLocally } from '../lib/sync';
import { useOnline } from '../hooks/useSync';
import { useAuth } from '../lib/auth';
import LoadRow from '../components/LoadRow';
import UnloadRow from '../components/UnloadRow';

export default function ShootDetail() {
    const { id = '' } = useParams();
    const online = useOnline();
    const { isAdmin } = useAuth();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [adhocName, setAdhocName] = useState('');
    const [showAdhoc, setShowAdhoc] = useState(false);

    const shoot = useLiveQuery(() => db.shoots.get(id), [id]);

    const shootItems = useLiveQuery(
        async () => {
            const rows = await db.shootItems.where('shoot_id').equals(id).toArray();

            return rows.sort((a, b) => a.item_id.localeCompare(b.item_id));
        },
        [id],
        [],
    );

    const itemsById = useLiveQuery(
        async () => {
            const items = await db.items.toArray();

            return new Map(items.map((item) => [item.id, item]));
        },
        [],
        new Map(),
    );

    if (!shoot) {
        return (
            <div className="p-4">
                <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">
                    Este rodaje no está en el celular. Conéctate y sincroniza.
                </p>
                <Link to="/" className="mt-4 block text-center text-sm font-medium text-slate-700">
                    Volver
                </Link>
            </div>
        );
    }

    const status = shootStatusLabels[shoot.status];
    const isLoadPhase = shoot.status === 'draft';
    const isUnloadPhase = shoot.status === 'loaded';
    const isReviewed = shoot.status === 'returned' || shoot.status === 'closed';

    const loadedItems = shootItems.filter((row) => row.quantity_loaded > 0);
    const pendingLoad = shootItems.filter((row) => row.load_status === 'pending').length;
    const pendingReturn = loadedItems.filter((row) => row.return_status === 'pending').length;
    const totalMissing = loadedItems.reduce(
        (sum, row) => sum + Math.max(0, row.quantity_loaded - row.quantity_returned - row.quantity_damaged),
        0,
    );
    const totalDamaged = loadedItems.reduce((sum, row) => sum + row.quantity_damaged, 0);

    async function handleItemChange(shootItem: ShootItem, changes: Partial<ShootItem>) {
        await updateShootItemLocally(shootItem, changes);
    }

    async function handleDownload() {
        setBusy(true);
        setMessage(null);

        try {
            await downloadShootForOffline(id);
            setMessage('Rodaje descargado. Ya puedes trabajar sin conexión.');
        } catch (error) {
            setMessage(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function handleConfirmLoad() {
        setBusy(true);

        try {
            await updateShootLocally(shoot!, {
                status: 'loaded',
                loaded_at: new Date().toISOString(),
            });
        } finally {
            setBusy(false);
        }
    }

    async function handleFinishUnload() {
        setBusy(true);

        try {
            await updateShootLocally(shoot!, {
                status: 'returned',
                returned_at: new Date().toISOString(),
            });
        } finally {
            setBusy(false);
        }
    }

    async function handleClose() {
        setBusy(true);
        setMessage(null);

        try {
            await api.post(`/shoots/${id}/close`);
            await downloadShootForOffline(id);
            setMessage('Rodaje cerrado.');
        } catch (error) {
            setMessage(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function handleAddAdhoc() {
        if (!adhocName.trim()) {
            return;
        }

        await addAdhocItemToShoot(shoot!, adhocName.trim(), 1);
        setAdhocName('');
        setShowAdhoc(false);
    }

    return (
        <div className="p-4">
            <Link to="/" className="mb-3 inline-block text-sm font-medium text-slate-500">
                ← Rodajes
            </Link>

            <div className="rounded-lg bg-white p-4 shadow-sm">
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <h2 className="font-semibold text-slate-900">{shoot.name}</h2>
                        <p className="text-sm text-slate-500">{shoot.project_name}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                    </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <dt className="text-xs text-slate-500">Ubicación</dt>
                        <dd className="text-slate-800">{shoot.location ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-slate-500">Fecha</dt>
                        <dd className="text-slate-800">{formatDate(shoot.scheduled_date)}</dd>
                    </div>
                </dl>

                {online && (
                    <button
                        type="button"
                        onClick={() => void handleDownload()}
                        disabled={busy}
                        className="mt-3 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
                    >
                        {shoot.downloaded_at ? 'Actualizar datos offline' : 'Descargar para trabajo offline'}
                    </button>
                )}

                {shoot.downloaded_at && (
                    <p className="mt-2 text-center text-xs font-medium text-emerald-600">
                        Descargado el {formatDate(shoot.downloaded_at)} · listo sin conexión
                    </p>
                )}
            </div>

            {message && (
                <p className="mt-3 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">{message}</p>
            )}

            {isReviewed && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                        <p className="text-2xl font-semibold text-rose-600 tabular-nums">{totalMissing}</p>
                        <p className="text-xs text-slate-500">Faltantes</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                        <p className="text-2xl font-semibold text-amber-600 tabular-nums">{totalDamaged}</p>
                        <p className="text-xs text-slate-500">Dañados</p>
                    </div>
                </div>
            )}

            <section className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                        {isLoadPhase ? 'Cargue' : isUnloadPhase ? 'Descargue' : 'Resumen'}
                    </h3>
                    <span className="text-xs text-slate-500">
                        {isLoadPhase
                            ? `${pendingLoad} sin confirmar`
                            : isUnloadPhase
                              ? `${pendingReturn} sin revisar`
                              : `${loadedItems.length} equipos`}
                    </span>
                </div>

                <ul className="space-y-2">
                    {isLoadPhase
                        ? shootItems.map((shootItem) => (
                              <LoadRow
                                  key={shootItem.id}
                                  shootItem={shootItem}
                                  item={itemsById.get(shootItem.item_id)}
                                  onChange={(changes) => void handleItemChange(shootItem, changes)}
                              />
                          ))
                        : loadedItems.map((shootItem) => (
                              <UnloadRow
                                  key={shootItem.id}
                                  shootItem={shootItem}
                                  item={itemsById.get(shootItem.item_id)}
                                  onChange={(changes) => void handleItemChange(shootItem, changes)}
                              />
                          ))}
                </ul>

                {(isLoadPhase || isUnloadPhase) && (
                    <div className="mt-3">
                        {showAdhoc ? (
                            <div className="rounded-lg bg-white p-3 shadow-sm">
                                <input
                                    type="text"
                                    value={adhocName}
                                    onChange={(event) => setAdhocName(event.target.value)}
                                    placeholder="Nombre del equipo que no estaba en la lista"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                                />
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void handleAddAdhoc()}
                                        className="rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white"
                                    >
                                        Agregar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAdhoc(false)}
                                        className="rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowAdhoc(true)}
                                className="w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600"
                            >
                                + Agregar equipo no planeado
                            </button>
                        )}
                    </div>
                )}
            </section>

            <div className="mt-6 space-y-2">
                {isLoadPhase && (
                    <button
                        type="button"
                        onClick={() => void handleConfirmLoad()}
                        disabled={busy || pendingLoad > 0}
                        className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-40"
                    >
                        {pendingLoad > 0
                            ? `Falta confirmar ${pendingLoad} equipo${pendingLoad === 1 ? '' : 's'}`
                            : 'Confirmar cargue y salir a rodaje'}
                    </button>
                )}

                {isUnloadPhase && (
                    <button
                        type="button"
                        onClick={() => void handleFinishUnload()}
                        disabled={busy || pendingReturn > 0}
                        className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-40"
                    >
                        {pendingReturn > 0
                            ? `Falta revisar ${pendingReturn} equipo${pendingReturn === 1 ? '' : 's'}`
                            : 'Terminar descargue'}
                    </button>
                )}

                {shoot.status === 'returned' && isAdmin && online && (
                    <button
                        type="button"
                        onClick={() => void handleClose()}
                        disabled={busy}
                        className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40"
                    >
                        Cerrar rodaje
                    </button>
                )}

                {shoot.status === 'returned' && !online && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
                        Descargue registrado. Se cerrará cuando vuelvas a tener señal y sincronices.
                    </p>
                )}
            </div>
        </div>
    );
}
