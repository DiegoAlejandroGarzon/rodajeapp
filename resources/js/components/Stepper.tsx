interface StepperProps {
    label: string;
    value: number;
    max: number;
    onChange: (value: number) => void;
    tone?: 'neutral' | 'danger';
}

export default function Stepper({ label, value, max, onChange, tone = 'neutral' }: StepperProps) {
    const canDecrease = value > 0;
    const canIncrease = value < max;

    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-600">{label}</span>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onChange(value - 1)}
                    disabled={!canDecrease}
                    aria-label={`Restar ${label}`}
                    className="size-9 rounded-lg border border-slate-300 text-lg font-semibold text-slate-700 disabled:opacity-30"
                >
                    −
                </button>

                <span
                    className={`w-10 text-center text-base font-semibold tabular-nums ${
                        tone === 'danger' && value > 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                >
                    {value}
                </span>

                <button
                    type="button"
                    onClick={() => onChange(value + 1)}
                    disabled={!canIncrease}
                    aria-label={`Sumar ${label}`}
                    className="size-9 rounded-lg border border-slate-300 text-lg font-semibold text-slate-700 disabled:opacity-30"
                >
                    +
                </button>
            </div>
        </div>
    );
}
