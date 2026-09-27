import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './lib/auth';
import Incidents from './pages/Incidents';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import NewShoot from './pages/NewShoot';
import Reports from './pages/Reports';
import ShootDetail from './pages/ShootDetail';
import Shoots from './pages/Shoots';

export default function App() {
    const { user, loading, isAdmin } = useAuth();
    const [update, setUpdate] = useState<(() => void) | null>(null);

    useEffect(() => {
        function handleUpdate(event: Event) {
            const detail = (event as CustomEvent<{ apply: () => void }>).detail;
            setUpdate(() => detail.apply);
        }

        window.addEventListener('rodaje:update-available', handleUpdate);

        return () => window.removeEventListener('rodaje:update-available', handleUpdate);
    }, []);

    if (loading) {
        return (
            <div className="grid min-h-dvh place-items-center bg-slate-900">
                <p className="text-sm text-slate-400">Cargando…</p>
            </div>
        );
    }

    if (!user) {
        return <Login />;
    }

    return (
        <>
            {/* La actualización nunca es automática: recargar en medio de un
                descargue haría perder lo que el usuario tiene en pantalla. */}
            {update && (
                <div className="fixed inset-x-0 top-0 z-50 flex items-center gap-3 bg-slate-900 px-4 py-2 text-sm text-white">
                    <span className="flex-1">Hay una versión nueva de la app.</span>
                    <button
                        type="button"
                        onClick={update}
                        className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-slate-900"
                    >
                        Actualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => setUpdate(null)}
                        className="text-xs text-slate-400"
                    >
                        Después
                    </button>
                </div>
            )}

            <Routes>
                <Route element={<Layout />}>
                    <Route index element={<Shoots />} />
                    <Route path="rodajes/nuevo" element={isAdmin ? <NewShoot /> : <Navigate to="/" replace />} />
                    <Route path="rodajes/:id" element={<ShootDetail />} />
                    <Route path="inventario" element={<Inventory />} />
                    <Route path="incidencias" element={isAdmin ? <Incidents /> : <Navigate to="/" replace />} />
                    <Route path="reportes" element={isAdmin ? <Reports /> : <Navigate to="/" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </>
    );
}
