import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// El shell HTML cambia en cada build porque referencia assets con hash nuevo,
// así que la revisión se ata al momento de compilación.
const buildRevision = Date.now().toString();

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/main.tsx'],
            refresh: true,
        }),
        tailwindcss(),
        react(),
        VitePWA({
            registerType: 'prompt',
            injectRegister: null,
            // El Service Worker debe quedar en la raíz de public: desde /build/
            // su alcance no cubriría las páginas de la app. Laravel fija el base
            // de Vite en /build/, y el plugin lo usa tanto para la URL de registro
            // como para el alcance, así que aquí lo forzamos a la raíz.
            outDir: 'public',
            base: '/',
            buildBase: '/',
            scope: '/',
            filename: 'sw.js',
            manifestFilename: 'manifest.webmanifest',
            manifest: {
                name: 'Control de Rodaje',
                short_name: 'Rodaje',
                description: 'Control de inventario en cargue y descargue de rodajes',
                lang: 'es',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/app',
                scope: '/',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    {
                        src: '/icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                globDirectory: 'public',
                globPatterns: ['build/assets/**/*.{js,css,woff2}', 'icons/*.png'],
                // El shell HTML lo renderiza Blade, así que no aparece en el bundle:
                // lo precacheamos a mano. Sin esto, abrir la app sin señal falla
                // aunque los assets sí estén en caché.
                additionalManifestEntries: [{ url: '/app', revision: buildRevision }],
                navigateFallback: '/app',
                navigateFallbackDenylist: [/^\/api\//, /^\/build\//],
                cleanupOutdatedCaches: true,
                // La API nunca se cachea: los datos se leen de IndexedDB. Una
                // respuesta vieja servida desde caché sería peor que un error claro.
                runtimeCaching: [
                    {
                        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
                        handler: 'NetworkOnly',
                    },
                ],
            },
            devOptions: {
                enabled: false,
            },
        }),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
