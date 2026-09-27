<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShootResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'project_name' => $this->project_name,
            'location' => $this->location,
            'scheduled_date' => $this->scheduled_date?->toDateString(),
            'expected_return_date' => $this->expected_return_date?->toDateString(),
            'responsible_user_id' => $this->responsible_user_id,
            'responsible' => UserResource::make($this->whenLoaded('responsible')),
            'status' => $this->status,
            'notes' => $this->notes,
            'loaded_at' => $this->loaded_at?->toIso8601String(),
            'returned_at' => $this->returned_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'items' => ShootItemResource::collection($this->whenLoaded('shootItems')),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
