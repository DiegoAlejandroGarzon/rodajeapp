<?php

namespace Database\Factories;

use App\Models\Shoot;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Shoot>
 */
class ShootFactory extends Factory
{
    protected $model = Shoot::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Rodaje '.$this->faker->words(2, true),
            'project_name' => $this->faker->words(2, true),
            'location' => $this->faker->city(),
            'scheduled_date' => now()->toDateString(),
            'expected_return_date' => now()->addDay()->toDateString(),
            'responsible_user_id' => User::factory(),
            'status' => Shoot::STATUS_DRAFT,
        ];
    }

    public function loaded(): static
    {
        return $this->state(fn () => [
            'status' => Shoot::STATUS_LOADED,
            'loaded_at' => now(),
        ]);
    }
}
