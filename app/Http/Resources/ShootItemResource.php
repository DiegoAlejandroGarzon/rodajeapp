<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShootItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'shoot_id' => $this->shoot_id,
            'item_id' => $this->item_id,
            'item' => ItemResource::make($this->whenLoaded('item')),
            'quantity_planned' => $this->quantity_planned,
            'quantity_loaded' => $this->quantity_loaded,
            'quantity_returned' => $this->quantity_returned,
            'quantity_damaged' => $this->quantity_damaged,
            'quantity_missing' => $this->quantityMissing(),
            'load_status' => $this->load_status,
            'return_status' => $this->return_status,
            'notes' => $this->notes,
            'loaded_at' => $this->loaded_at?->toIso8601String(),
            'returned_at' => $this->returned_at?->toIso8601String(),
            'was_added_in_field' => $this->was_added_in_field,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
