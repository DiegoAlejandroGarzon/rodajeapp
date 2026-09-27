import { returnStatusLabels } from '../lib/labels';
import type { Item, ShootItem } from '../lib/db';
import Stepper from './Stepper';

interface UnloadRowProps {
    shootItem: ShootItem;
    item: Item | undefined;
    onChange: (changes: Partial<ShootItem>) => void;
}

export default function UnloadRow({ shootItem, item, onChange }: UnloadRowProps) {
    const loaded = shootItem.quantity_loaded;
    const isSingle = loaded === 1;
    const status = returnStatusLabels[shootItem.return_status];
    const missing = Math.max(0, loaded - shootItem.quantity_returned - shootItem.quantity_damaged);
    const reviewed = shootItem.return_status !== 'pending';

    function mark(returned: number, damaged: number) {
        onChange({
            quantity_returned: returned,
            quantity_damaged: damaged,
            returned_at: new Date().toISOString(),
        });
    }

    return (
        <li
            className={`rounded-lg bg-white p-4 shadow-sm ${
                reviewed ? '' : 'ring-1 ring-slate-200'
            }`}
        >
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{item?.name ?? 'Equipo desconocido'}</p>
                    <p className="text-xs text-slate-500">
                        Salieron: {loaded}
                        {shootItem.was_added_in_field && ' · agregado en locación'}
                    </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                </span>
            </div>

            {isSingle ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => mark(1, 0)}
                        className={`rounded-lg py-2.5 text-sm font-semibold ${
                            shootItem.quantity_returned === 1
                                ? 'bg-emerald-600 text-white'
                                : 'border border-slate-300 text-slate-700'
                        }`}
                    >
                        Volvió
                    </button>
                    <button
                        type="button"
                        onClick={() => mark(0, 1)}
                        className={`rounded-lg py-2.5 text-sm font-semibold ${
                            shootItem.quantity_damaged === 1
                                ? 'bg-amber-500 text-white'
                                : 'border border-slate-300 text-slate-700'
                        }`}
                    >
                        Dañado
                    </button>
                    <button
                        type="button"
                        onClick={() => mark(0, 0)}
                        className={`rounded-lg py-2.5 text-sm font-semibold ${
                            reviewed && shootItem.return_status === 'missing'
                                ? 'bg-rose-600 text-white'
                                : 'border border-slate-300 text-slate-700'
                        }`}
                    >
                        Falta
                    </button>
                </div>
            ) : (
                <div className="mt-3 space-y-2">
                    <Stepper
                        label="Volvieron bien"
                        value={shootItem.quantity_returned}
                        max={loaded - shootItem.quantity_damaged}
                        onChange={(value) => mark(value, shootItem.quantity_damaged)}
                    />
                    <Stepper
                        label="Volvieron dañados"
                        value={shootItem.quantity_damaged}
                        max={loaded - shootItem.quantity_returned}
                        onChange={(value) => mark(shootItem.quantity_returned, value)}
                        tone="danger"
                    />
                    {missing > 0 && (
                        <p className="rounded-md bg-rose-50 px-2 py-1.5 text-sm font-medium text-rose-700">
                            Faltan {missing} de {loaded}
                        </p>
                    )}
                </div>
            )}

            <input
                type="text"
                defaultValue={shootItem.notes ?? ''}
                onBlur={(event) => {
                    if (event.target.value !== (shootItem.notes ?? '')) {
                        onChange({ notes: event.target.value });
                    }
                }}
                placeholder="Nota (opcional)"
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-slate-400 focus:outline-none"
            />
        </li>
    );
}
