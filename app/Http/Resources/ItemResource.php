<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category' => CategoryResource::make($this->whenLoaded('category')),
            'name' => $this->name,
            'code' => $this->code,
            'serial' => $this->serial,
            'quantity' => $this->quantity,
            'reference_value' => $this->reference_value,
            'status' => $this->status,
            'notes' => $this->notes,
            'is_adhoc' => $this->is_adhoc,
            'needs_review' => $this->needs_review,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
