import { NavLink, Outlet } from 'react-router-dom';
import { useSync } from '../hooks/useSync';
import { useAuth } from '../lib/auth';
import SyncBar from './SyncBar';

const navItems = [
    { to: '/', label: 'Rodajes', adminOnly: false },
    { to: '/inventario', label: 'Inventario', adminOnly: false },
    { to: '/incidencias', label: 'Faltantes', adminOnly: true },
    { to: '/reportes', label: 'Reportes', adminOnly: true },
];

export default function Layout() {
    const syncState = useSync();
    const { user, isAdmin, logout } = useAuth();

    return (
        <div className="flex min-h-dvh flex-col bg-slate-100">
            <SyncBar state={syncState} />

            <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-semibold text-slate-900">Control de Rodaje</h1>
                    <p className="truncate text-xs text-slate-500">{user?.name}</p>
                </div>
                <button
                    type="button"
                    onClick={() => void logout()}
                    className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                    Salir
                </button>
            </header>

            <main className="flex-1 pb-20">
                <Outlet />
            </main>

            {/* Navegación abajo: el productor usa esto con una mano, en locación. */}
            <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
                {navItems
                    .filter((item) => !item.adminOnly || isAdmin)
                    .map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                                `py-3 text-center text-xs font-medium ${
                                    isActive ? 'text-slate-900' : 'text-slate-400'
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
            </nav>
        </div>
    );
}
