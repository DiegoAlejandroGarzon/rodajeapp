<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ShootResource;
use App\Models\Shoot;
use App\Models\ShootItem;
use App\Services\IncidentReconciler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ShootController extends Controller
{
    public function __construct(private readonly IncidentReconciler $reconciler)
    {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $shoots = Shoot::query()
            ->with('responsible')
            ->withCount('shootItems')
            ->when($request->input('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->input('responsible_user_id'), fn ($query, $id) => $query->where('responsible_user_id', $id))
            ->when(! $request->user()->isAdmin(), fn ($query) => $query->where('responsible_user_id', $request->user()->id))
            ->orderByDesc('scheduled_date')
            ->paginate($request->integer('per_page', 25));

        return ShootResource::collection($shoots);
    }

    public function show(Shoot $shoot): ShootResource
    {
        return ShootResource::make($shoot->load(['responsible', 'shootItems.item.category']));
    }

    public function store(Request $request): ShootResource
    {
        $data = $request->validate([
            'id' => ['sometimes', 'uuid'],
            'name' => ['required', 'string', 'max:255'],
            'project_name' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'scheduled_date' => ['required', 'date'],
            'expected_return_date' => ['nullable', 'date', 'after_or_equal:scheduled_date'],
            'responsible_user_id' => ['required', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['created_by_user_id'] = $request->user()->id;

        $shoot = Shoot::create($data);

        return ShootResource::make($shoot->load(['responsible', 'shootItems.item.category']));
    }

    public function update(Request $request, Shoot $shoot): ShootResource
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'project_name' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'scheduled_date' => ['sometimes', 'date'],
            'expected_return_date' => ['nullable', 'date'],
            'responsible_user_id' => ['sometimes', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in([
                Shoot::STATUS_DRAFT,
                Shoot::STATUS_LOADED,
                Shoot::STATUS_RETURNED,
                Shoot::STATUS_CANCELLED,
            ])],
        ]);

        $shoot->update($data);

        return ShootResource::make($shoot->load(['responsible', 'shootItems.item.category']));
    }

    /**
     * Define la lista planificada de cargue. Solo con conexión, durante la
     * planificación: en campo los cambios entran por el endpoint de sincronización.
     */
    public function setItems(Request $request, Shoot $shoot): ShootResource
    {
        abort_if($shoot->status !== Shoot::STATUS_DRAFT, 422, 'Solo se puede editar la lista de un rodaje en borrador.');

        $data = $request->validate([
            'items' => ['required', 'array'],
            'items.*.item_id' => ['required', 'uuid', 'exists:items,id'],
            'items.*.quantity_planned' => ['required', 'integer', 'min:1'],
            'items.*.notes' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($shoot, $data) {
            $keptItemIds = [];

            foreach ($data['items'] as $row) {
                $shootItem = ShootItem::updateOrCreate(
                    ['shoot_id' => $shoot->id, 'item_id' => $row['item_id']],
                    [
                        'quantity_planned' => $row['quantity_planned'],
                        'notes' => $row['notes'] ?? null,
                    ],
                );

                $keptItemIds[] = $shootItem->item_id;
            }

            $shoot->shootItems()->whereNotIn('item_id', $keptItemIds)->delete();
        });

        return ShootResource::make($shoot->load(['responsible', 'shootItems.item.category']));
    }

    /**
     * Cierre final por parte del productor, ya con conexión y tras revisar el
     * descargue. Recalcula incidencias para que el reporte quede consistente.
     */
    public function close(Shoot $shoot): ShootResource
    {
        abort_if($shoot->status !== Shoot::STATUS_RETURNED, 422, 'Solo se puede cerrar un rodaje que ya fue descargado.');

        DB::transaction(function () use ($shoot) {
            $this->reconciler->reconcile($shoot);

            $shoot->update([
                'status' => Shoot::STATUS_CLOSED,
                'closed_at' => now(),
            ]);
        });

        return ShootResource::make($shoot->load(['responsible', 'shootItems.item.category']));
    }

    public function destroy(Shoot $shoot): JsonResponse
    {
        abort_if($shoot->status === Shoot::STATUS_CLOSED, 422, 'No se puede eliminar un rodaje cerrado.');

        $shoot->delete();

        return response()->json(['message' => 'Rodaje eliminado.']);
    }
}
