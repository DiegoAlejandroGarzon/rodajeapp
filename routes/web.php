<?php

use Illuminate\Support\Facades\Route;

Route::redirect('/', '/app');

// Vite emite el manifest dentro de /build, pero la PWA lo necesita en la raíz
// para que su alcance cubra toda la app.
Route::get('/manifest.webmanifest', fn () => response()->file(
    public_path('build/manifest.webmanifest'),
    ['Content-Type' => 'application/manifest+json'],
));

// La SPA maneja su propio enrutamiento: cualquier ruta bajo /app devuelve el shell,
// que es también el navigateFallback del Service Worker cuando no hay red.
Route::view('/app/{path?}', 'app')->where('path', '.*');
