import type { Item, ShootItem } from '../lib/db';
import Stepper from './Stepper';

interface LoadRowProps {
    shootItem: ShootItem;
    item: Item | undefined;
    onChange: (changes: Partial<ShootItem>) => void;
}

export default function LoadRow({ shootItem, item, onChange }: LoadRowProps) {
    const planned = shootItem.quantity_planned;
    const isSingle = planned === 1;
    const confirmed = shootItem.load_status === 'confirmed';
    const skipped = shootItem.load_status === 'skipped';

    return (
        <li className="rounded-lg bg-white p-4 shadow-sm">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{item?.name ?? 'Equipo desconocido'}</p>
                    <p className="text-xs text-slate-500">
                        Planeado: {planned}
                        {item?.code ? ` · ${item.code}` : ''}
                    </p>
                </div>
            </div>

            {isSingle ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            onChange({
                                load_status: 'confirmed',
                                quantity_loaded: 1,
                                loaded_at: new Date().toISOString(),
                            })
                        }
                        className={`rounded-lg py-2.5 text-sm font-semibold ${
                            confirmed
                                ? 'bg-emerald-600 text-white'
                                : 'border border-slate-300 text-slate-700'
                        }`}
                    >
                        Salió
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange({ load_status: 'skipped', quantity_loaded: 0 })}
                        className={`rounded-lg py-2.5 text-sm font-semibold ${
                            skipped ? 'bg-slate-700 text-white' : 'border border-slate-300 text-slate-700'
                        }`}
                    >
                        No salió
                    </button>
                </div>
            ) : (
                <div className="mt-3 space-y-2">
                    <Stepper
                        label="Cantidad que salió"
                        value={shootItem.quantity_loaded}
                        max={planned}
                        onChange={(value) =>
                            onChange({
                                quantity_loaded: value,
                                load_status: value > 0 ? 'confirmed' : 'skipped',
                                loaded_at: value > 0 ? new Date().toISOString() : null,
                            })
                        }
                    />
                </div>
            )}
        </li>
    );
}
