<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ItemResource;
use App\Http\Resources\ShootResource;
use App\Http\Resources\UserResource;
use App\Models\Category;
use App\Models\Item;
use App\Models\Shoot;
use App\Models\User;
use App\Services\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function __construct(private readonly SyncService $syncService)
    {
    }

    /**
     * Paquete completo para trabajar sin conexión. El cliente lo descarga de forma
     * explícita antes de salir a locación, en lugar de confiar en lo que el
     * Service Worker haya alcanzado a cachear por navegación.
     */
    public function bootstrap(Request $request): JsonResponse
    {
        $user = $request->user();

        $shoots = Shoot::query()
            ->with(['responsible', 'shootItems.item.category'])
            ->whereIn('status', [Shoot::STATUS_DRAFT, Shoot::STATUS_LOADED, Shoot::STATUS_RETURNED])
            ->when(! $user->isAdmin(), fn ($query) => $query->where('responsible_user_id', $user->id))
            ->orderBy('scheduled_date')
            ->get();

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'categories' => CategoryResource::collection(Category::orderBy('sort_order')->orderBy('name')->get()),
            'items' => ItemResource::collection(Item::with('category')->orderBy('name')->get()),
            'responsables' => UserResource::collection(User::where('is_active', true)->orderBy('name')->get()),
            'shoots' => ShootResource::collection($shoots),
        ]);
    }

    /**
     * Paquete de un solo rodaje, para el botón "descargar para trabajo offline".
     */
    public function shootPackage(Request $request, Shoot $shoot): JsonResponse
    {
        $user = $request->user();

        abort_if(! $user->isAdmin() && $shoot->responsible_user_id !== $user->id, 403);

        $shoot->load(['responsible', 'shootItems.item.category']);

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'shoot' => ShootResource::make($shoot),
        ]);
    }

    /**
     * Recibe el lote de cambios que el celular acumuló sin conexión.
     */
    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['nullable', 'string', 'max:255'],
            'operations' => ['required', 'array', 'min:1', 'max:500'],
            'operations.*.id' => ['required', 'uuid'],
            'operations.*.entity' => ['required', 'string', 'in:item,shoot,shoot_item'],
            'operations.*.entity_id' => ['required', 'uuid'],
            'operations.*.action' => ['required', 'string', 'in:create,update'],
            'operations.*.client_created_at' => ['required', 'date'],
            'operations.*.payload' => ['required', 'array'],
        ]);

        ['results' => $results, 'shoot_ids' => $shootIds] = $this->syncService->push(
            $request->user(),
            $validated['device_id'] ?? null,
            $validated['operations'],
        );

        // Devolvemos el estado fresco de los rodajes tocados para que el cliente
        // reemplace su copia local y vea de inmediato si algo se descartó.
        $shoots = Shoot::with(['responsible', 'shootItems.item.category'])
            ->whereIn('id', $shootIds)
            ->get();

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'results' => $results,
            'shoots' => ShootResource::collection($shoots),
        ]);
    }
}
