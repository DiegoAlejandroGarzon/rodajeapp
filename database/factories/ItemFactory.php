<?php

namespace Database\Factories;

use App\Models\Item;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Item>
 */
class ItemFactory extends Factory
{
    protected $model = Item::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->words(2, true),
            'quantity' => 1,
            'reference_value' => $this->faker->numberBetween(50_000, 5_000_000),
            'status' => Item::STATUS_AVAILABLE,
        ];
    }
}
