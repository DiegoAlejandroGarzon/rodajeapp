<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncidentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'shoot_id' => $this->shoot_id,
            'shoot' => ShootResource::make($this->whenLoaded('shoot')),
            'item_id' => $this->item_id,
            'item' => ItemResource::make($this->whenLoaded('item')),
            'responsible_user_id' => $this->responsible_user_id,
            'responsible' => UserResource::make($this->whenLoaded('responsible')),
            'type' => $this->type,
            'quantity' => $this->quantity,
            'estimated_loss' => $this->estimated_loss,
            'description' => $this->description,
            'status' => $this->status,
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolution_notes' => $this->resolution_notes,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
