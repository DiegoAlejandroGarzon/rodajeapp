<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\ItemController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ShootController;
use App\Http\Controllers\Api\SyncController;
use Illuminate\Support\Facades\Route;

Route::post('login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    // Sincronización offline.
    Route::get('sync/bootstrap', [SyncController::class, 'bootstrap']);
    Route::get('sync/shoots/{shoot}', [SyncController::class, 'shootPackage']);
    Route::post('sync/push', [SyncController::class, 'push']);

    Route::apiResource('categories', CategoryController::class)->except('show');

    Route::apiResource('items', ItemController::class);
    Route::post('items/{item}/approve', [ItemController::class, 'approve']);

    Route::apiResource('shoots', ShootController::class);
    Route::put('shoots/{shoot}/items', [ShootController::class, 'setItems']);
    Route::post('shoots/{shoot}/close', [ShootController::class, 'close']);

    Route::get('incidents', [IncidentController::class, 'index']);
    Route::put('incidents/{incident}', [IncidentController::class, 'update']);

    Route::prefix('reports')->group(function () {
        Route::get('summary', [ReportController::class, 'summary']);
        Route::get('by-responsible', [ReportController::class, 'byResponsible']);
        Route::get('risky-items', [ReportController::class, 'riskyItems']);
        Route::get('overdue-shoots', [ReportController::class, 'overdueShoots']);
    });
});
