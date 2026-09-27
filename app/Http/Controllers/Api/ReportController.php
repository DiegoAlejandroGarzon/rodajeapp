<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ShootResource;
use App\Models\Incident;
use App\Models\Item;
use App\Models\Shoot;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function summary(): JsonResponse
    {
        return response()->json([
            'items_total' => Item::count(),
            'items_needing_review' => Item::where('needs_review', true)->count(),
            'shoots_in_field' => Shoot::where('status', Shoot::STATUS_LOADED)->count(),
            'shoots_pending_close' => Shoot::where('status', Shoot::STATUS_RETURNED)->count(),
            'incidents_open' => Incident::open()->count(),
            'estimated_loss_open' => (float) Incident::open()->sum('estimated_loss'),
        ]);
    }

    /**
     * El reporte que buscaba el productor: patrones de faltantes por responsable.
     */
    public function byResponsible(): JsonResponse
    {
        $rows = Incident::query()
            ->join('users', 'users.id', '=', 'incidents.responsible_user_id')
            ->groupBy('users.id', 'users.name')
            ->select([
                'users.id as user_id',
                'users.name as user_name',
                DB::raw('count(*) as incidents_total'),
                DB::raw("sum(case when incidents.type = 'missing' then incidents.quantity else 0 end) as units_missing"),
                DB::raw("sum(case when incidents.type = 'damaged' then incidents.quantity else 0 end) as units_damaged"),
                DB::raw('sum(incidents.estimated_loss) as estimated_loss'),
            ])
            ->orderByDesc('incidents_total')
            ->get();

        $shootCounts = Shoot::query()
            ->whereIn('status', [Shoot::STATUS_RETURNED, Shoot::STATUS_CLOSED])
            ->groupBy('responsible_user_id')
            ->select('responsible_user_id', DB::raw('count(*) as total'))
            ->pluck('total', 'responsible_user_id');

        return response()->json([
            'data' => $rows->map(function ($row) use ($shootCounts) {
                $shootsCompleted = (int) ($shootCounts[$row->user_id] ?? 0);

                return [
                    'user_id' => $row->user_id,
                    'user_name' => $row->user_name,
                    'shoots_completed' => $shootsCompleted,
                    'incidents_total' => (int) $row->incidents_total,
                    'units_missing' => (int) $row->units_missing,
                    'units_damaged' => (int) $row->units_damaged,
                    'estimated_loss' => (float) $row->estimated_loss,
                    // Incidencias por rodaje: compara responsables con distinta carga de trabajo.
                    'incidents_per_shoot' => $shootsCompleted > 0
                        ? round($row->incidents_total / $shootsCompleted, 2)
                        : null,
                ];
            }),
        ]);
    }

    /**
     * Equipos que se pierden o se dañan de forma recurrente.
     */
    public function riskyItems(): JsonResponse
    {
        $rows = Incident::query()
            ->join('items', 'items.id', '=', 'incidents.item_id')
            ->groupBy('items.id', 'items.name')
            ->select([
                'items.id as item_id',
                'items.name as item_name',
                DB::raw('count(*) as incidents_total'),
                DB::raw('sum(incidents.quantity) as units_affected'),
                DB::raw('sum(incidents.estimated_loss) as estimated_loss'),
            ])
            ->orderByDesc('incidents_total')
            ->limit(20)
            ->get();

        return response()->json(['data' => $rows]);
    }

    /**
     * Rodajes que salieron y pasaron su fecha de retorno sin descargue: la alerta
     * que evita que un faltante se pierda de vista.
     */
    public function overdueShoots(): JsonResponse
    {
        $shoots = Shoot::query()
            ->with('responsible')
            ->withCount('shootItems')
            ->where('status', Shoot::STATUS_LOADED)
            ->whereNotNull('expected_return_date')
            ->whereDate('expected_return_date', '<', now()->toDateString())
            ->orderBy('expected_return_date')
            ->get();

        return response()->json([
            'data' => ShootResource::collection($shoots),
        ]);
    }
}
