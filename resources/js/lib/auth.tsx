import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { api, getToken, isNetworkError, setToken } from './api';
import { clearLocalData, getMeta, setMeta } from './db';

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'session_user';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function restoreSession() {
            if (!getToken()) {
                setLoading(false);

                return;
            }

            // La sesión se restaura desde IndexedDB primero: en locación sin señal
            // la app debe abrir igual, sin esperar la validación del servidor.
            const cached = await getMeta<AuthUser>(USER_KEY);

            if (cached && !cancelled) {
                setUser(cached);
            }

            try {
                const response = await api.get<{ user: AuthUser }>('/me');

                if (!cancelled) {
                    setUser(response.data.user);
                    await setMeta(USER_KEY, response.data.user);
                }
            } catch (error) {
                // Solo cerramos sesión si el servidor respondió que el token no
                // sirve. Un fallo de red no debe expulsar al usuario en el campo.
                if (!isNetworkError(error) && !cancelled) {
                    setToken(null);
                    setUser(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void restoreSession();

        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const response = await api.post<{ token: string; user: AuthUser }>('/login', {
            email,
            password,
            device_name: navigator.userAgent.slice(0, 120),
        });

        setToken(response.data.token);
        setUser(response.data.user);
        await setMeta(USER_KEY, response.data.user);
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post('/logout');
        } catch {
            // Si no hay red, igual limpiamos la sesión local.
        }

        setToken(null);
        setUser(null);
        await clearLocalData();
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ user, loading, isAdmin: user?.role === 'admin', login, logout }),
        [user, loading, login, logout],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider.');
    }

    return context;
}
