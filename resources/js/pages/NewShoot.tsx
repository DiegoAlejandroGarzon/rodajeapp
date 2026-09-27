import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { db } from '../lib/db';
import { downloadShootForOffline, pullBootstrap } from '../lib/sync';

export default function NewShoot() {
    const navigate = useNavigate();
    const [step, setStep] = useState<'datos' | 'equipos'>('datos');
    const [shootId, setShootId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [form, setForm] = useState({
        name: '',
        project_name: '',
        location: '',
        scheduled_date: new Date().toISOString().slice(0, 10),
        expected_return_date: '',
        responsible_user_id: '',
    });

    const [selected, setSelected] = useState<Record<string, number>>({});
    const [search, setSearch] = useState('');

    const responsables = useLiveQuery(() => db.responsables.toArray(), [], []);
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
                .filter((item) => term === '' || item.name.toLowerCase().includes(term))
                .sort((a, b) => a.name.localeCompare(b.name));
        },
        [search],
        [],
    );

    async function submitData(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);

        try {
            const response = await api.post<{ data: { id: string } }>('/shoots', {
                ...form,
                expected_return_date: form.expected_return_date || null,
                project_name: form.project_name || null,
                location: form.location || null,
            });

            setShootId(response.data.data.id);
            setStep('equipos');
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setBusy(false);
        }
    }

    async function submitItems() {
        if (!shootId) {
            return;
        }

        setBusy(true);
        setError(null);

        try {
            await api.put(`/shoots/${shootId}/items`, {
                items: Object.entries(selected).map(([itemId, quantity]) => ({
                    item_id: itemId,
                    quantity_planned: quantity,
                })),
            });

            await pullBootstrap();
            // Lo dejamos listo para offline de una vez: es el momento en que hay señal.
            await downloadShootForOffline(shootId);

            navigate(`/rodajes/${shootId}`);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setBusy(false);
        }
    }

    function toggle(itemId: string, maxQuantity: number) {
        setSelected((current) => {
            if (current[itemId]) {
                const { [itemId]: _removed, ...rest } = current;

                return rest;
            }

            return { ...current, [itemId]: Math.min(1, maxQuantity) || 1 };
        });
    }

    const selectedCount = Object.keys(selected).length;

    if (step === 'datos') {
        return (
            <form onSubmit={submitData} className="space-y-3 p-4">
                <h2 className="text-lg font-semibold text-slate-900">Nuevo rodaje</h2>

                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

                <Field label="Nombre del rodaje">
                    <input
                        required
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        className={inputClass}
                    />
                </Field>

                <Field label="Proyecto">
                    <input
                        value={form.project_name}
                        onChange={(event) => setForm({ ...form, project_name: event.target.value })}
                        className={inputClass}
                    />
                </Field>

                <Field label="Ubicación">
                    <input
                        value={form.location}
                        onChange={(event) => setForm({ ...form, location: event.target.value })}
                        className={inputClass}
                    />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Fecha de salida">
                        <input
                            type="date"
                            required
                            value={form.scheduled_date}
                            onChange={(event) => setForm({ ...form, scheduled_date: event.target.value })}
                            className={inputClass}
                        />
                    </Field>

                    <Field label="Retorno esperado">
                        <input
                            type="date"
                            value={form.expected_return_date}
                            onChange={(event) => setForm({ ...form, expected_return_date: event.target.value })}
                            className={inputClass}
                        />
                    </Field>
                </div>

                <Field label="Responsable">
                    <select
                        required
                        value={form.responsible_user_id}
                        onChange={(event) => setForm({ ...form, responsible_user_id: event.target.value })}
                        className={inputClass}
                    >
                        <option value="">Selecciona…</option>
                        {responsables.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.name}
                            </option>
                        ))}
                    </select>
                </Field>

                <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-50"
                >
                    Siguiente: elegir equipos
                </button>
            </form>
        );
    }

    return (
        <div className="p-4 pb-24">
            <h2 className="text-lg font-semibold text-slate-900">¿Qué se lleva?</h2>
            <p className="mb-3 text-sm text-slate-500">
                Marca los equipos que salen. Podrás confirmar cantidades en el cargue.
            </p>

            {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

            <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar equipo"
                className={inputClass}
            />

            <ul className="mt-3 space-y-2">
                {items.map((item) => {
                    const isSelected = selected[item.id] !== undefined;

                    return (
                        <li key={item.id}>
                            <button
                                type="button"
                                onClick={() => toggle(item.id, item.quantity)}
                                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left shadow-sm ${
                                    isSelected ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                                }`}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{item.name}</p>
                                    <p
                                        className={`truncate text-xs ${
                                            isSelected ? 'text-slate-300' : 'text-slate-500'
                                        }`}
                                    >
                                        {categories.get(item.category_id ?? '')?.name ?? 'Sin categoría'} ·{' '}
                                        {item.quantity} disponibles
                                    </p>
                                </div>

                                {isSelected && (
                                    <div className="flex shrink-0 items-center gap-1">
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelected((current) => ({
                                                    ...current,
                                                    [item.id]: Math.max(1, current[item.id] - 1),
                                                }));
                                            }}
                                            onKeyDown={(event) => event.stopPropagation()}
                                            className="grid size-8 place-items-center rounded bg-white/15 text-lg"
                                        >
                                            −
                                        </span>
                                        <span className="w-6 text-center font-semibold tabular-nums">
                                            {selected[item.id]}
                                        </span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelected((current) => ({
                                                    ...current,
                                                    [item.id]: Math.min(item.quantity, current[item.id] + 1),
                                                }));
                                            }}
                                            onKeyDown={(event) => event.stopPropagation()}
                                            className="grid size-8 place-items-center rounded bg-white/15 text-lg"
                                        >
                                            +
                                        </span>
                                    </div>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button
                    type="button"
                    onClick={() => void submitItems()}
                    disabled={busy || selectedCount === 0}
                    className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white disabled:opacity-40"
                >
                    {selectedCount === 0
                        ? 'Selecciona al menos un equipo'
                        : `Guardar ${selectedCount} equipo${selectedCount === 1 ? '' : 's'} y descargar offline`}
                </button>
            </div>
        </div>
    );
}

const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
            {children}
        </label>
    );
}
