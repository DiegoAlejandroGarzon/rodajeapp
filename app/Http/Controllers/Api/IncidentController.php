<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class IncidentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $incidents = Incident::query()
            ->with(['item.category', 'responsible', 'shoot'])
            ->when($request->input('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->input('type'), fn ($query, $type) => $query->where('type', $type))
            ->when($request->input('responsible_user_id'), fn ($query, $id) => $query->where('responsible_user_id', $id))
            ->when($request->input('shoot_id'), fn ($query, $id) => $query->where('shoot_id', $id))
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 25));

        return IncidentResource::collection($incidents);
    }

    public function update(Request $request, Incident $incident): IncidentResource
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in([
                Incident::STATUS_OPEN,
                Incident::STATUS_RESOLVED,
                Incident::STATUS_WRITTEN_OFF,
            ])],
            'resolution_notes' => ['nullable', 'string'],
            'estimated_loss' => ['nullable', 'numeric', 'min:0'],
        ]);

        if (isset($data['status'])) {
            $data['resolved_at'] = $data['status'] === Incident::STATUS_OPEN ? null : now();
        }

        $incident->update($data);

        return IncidentResource::make($incident->load(['item.category', 'responsible', 'shoot']));
    }
}
