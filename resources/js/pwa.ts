import { registerSW } from 'virtual:pwa-register';

/**
 * Registramos el Service Worker manualmente y con actualización manual: en medio
 * de un rodaje no queremos que la app se recargue sola y pierda lo que el usuario
 * está marcando en pantalla.
 */
export function registerServiceWorker(): void {
    if (import.meta.env.DEV) {
        return;
    }

    const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
            window.dispatchEvent(
                new CustomEvent('rodaje:update-available', { detail: { apply: () => void updateSW(true) } }),
            );
        },
        onOfflineReady() {
            window.dispatchEvent(new CustomEvent('rodaje:offline-ready'));
        },
    });
}
