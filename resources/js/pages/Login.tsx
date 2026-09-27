import { useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { pullBootstrap } from '../lib/sync';

export default function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await login(email, password);
            // Descargamos el catálogo de inmediato: al entrar siempre hay señal,
            // y así la app queda usable si la siguiente apertura es en locación.
            await pullBootstrap();
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-semibold text-white">Control de Rodaje</h1>
                    <p className="mt-1 text-sm text-slate-400">Inventario en cargue y descargue</p>
                </div>

                {error && (
                    <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>
                )}

                <label className="block">
                    <span className="text-sm font-medium text-slate-300">Correo</span>
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                    />
                </label>

                <label className="block">
                    <span className="text-sm font-medium text-slate-300">Contraseña</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        autoComplete="current-password"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none"
                    />
                </label>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-white px-4 py-2.5 font-semibold text-slate-900 disabled:opacity-60"
                >
                    {submitting ? 'Entrando…' : 'Entrar'}
                </button>
            </form>
        </div>
    );
}
