<?php

namespace Database\Factories;

use App\Models\Item;
use App\Models\Shoot;
use App\Models\ShootItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShootItem>
 */
class ShootItemFactory extends Factory
{
    protected $model = ShootItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'shoot_id' => Shoot::factory(),
            'item_id' => Item::factory(),
            'quantity_planned' => 1,
            'quantity_loaded' => 0,
            'quantity_returned' => 0,
            'quantity_damaged' => 0,
            'load_status' => ShootItem::LOAD_PENDING,
            'return_status' => ShootItem::RETURN_PENDING,
        ];
    }

    public function loaded(int $quantity = 1): static
    {
        return $this->state(fn () => [
            'quantity_planned' => $quantity,
            'quantity_loaded' => $quantity,
            'load_status' => ShootItem::LOAD_CONFIRMED,
            'loaded_at' => now(),
        ]);
    }
}
