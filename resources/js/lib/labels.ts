import type { ReturnStatus, ShootStatus } from './db';

export const shootStatusLabels: Record<ShootStatus, { label: string; className: string }> = {
    draft: { label: 'Borrador', className: 'bg-slate-100 text-slate-700' },
    loaded: { label: 'En rodaje', className: 'bg-blue-100 text-blue-800' },
    returned: { label: 'Descargado', className: 'bg-amber-100 text-amber-800' },
    closed: { label: 'Cerrado', className: 'bg-emerald-100 text-emerald-800' },
    cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500' },
};

export const returnStatusLabels: Record<ReturnStatus, { label: string; className: string }> = {
    pending: { label: 'Sin revisar', className: 'bg-slate-100 text-slate-600' },
    complete: { label: 'Completo', className: 'bg-emerald-100 text-emerald-800' },
    partial: { label: 'Parcial', className: 'bg-amber-100 text-amber-800' },
    missing: { label: 'Falta', className: 'bg-rose-100 text-rose-800' },
};

export function formatMoney(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
        return '—';
    }

    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(Number(value));
}

export function formatDate(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(value),
    );
}
