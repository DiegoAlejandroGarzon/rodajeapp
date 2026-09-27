import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'rodaje.token';
const DEVICE_KEY = 'rodaje.device_id';

export const api = axios.create({
    baseURL: '/api',
    headers: { Accept: 'application/json' },
});

export function getToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setToken(token: string | null): void {
    try {
        if (token === null) {
            localStorage.removeItem(TOKEN_KEY);
        } else {
            localStorage.setItem(TOKEN_KEY, token);
        }
    } catch {
        // Modo privado o almacenamiento bloqueado: la sesión durará lo que dure la pestaña.
    }
}

/**
 * Identificador estable del dispositivo, para que el servidor pueda auditar de
 * qué celular vino cada sincronización.
 */
export function getDeviceId(): string {
    try {
        const existing = localStorage.getItem(DEVICE_KEY);

        if (existing) {
            return existing;
        }

        const generated = crypto.randomUUID();
        localStorage.setItem(DEVICE_KEY, generated);

        return generated;
    } catch {
        return 'dispositivo-sin-almacenamiento';
    }
}

api.interceptors.request.use((config) => {
    const token = getToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

/**
 * Distingue "no hay red" de "el servidor respondió con error". Es la diferencia
 * entre reintentar más tarde y avisarle al usuario que algo se rechazó.
 */
export function isNetworkError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
        return false;
    }

    const axiosError = error as AxiosError;

    return axiosError.response === undefined;
}

export function errorMessage(error: unknown): string {
    if (isNetworkError(error)) {
        return 'Sin conexión con el servidor.';
    }

    if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;

        if (data?.errors) {
            return Object.values(data.errors).flat().join(' ');
        }

        return data?.message ?? 'Ocurrió un error inesperado.';
    }

    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}
