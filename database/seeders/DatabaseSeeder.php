<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Item;
use App\Models\Shoot;
use App\Models\ShootItem;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $productor = User::create([
            'name' => 'Productor',
            'email' => 'productor@rodaje.test',
            'password' => 'password',
            'role' => User::ROLE_ADMIN,
        ]);

        $gaffer = User::create([
            'name' => 'Carlos Gaffer',
            'email' => 'carlos@rodaje.test',
            'password' => 'password',
            'role' => User::ROLE_RESPONSABLE,
        ]);

        User::create([
            'name' => 'Ana Sonidista',
            'email' => 'ana@rodaje.test',
            'password' => 'password',
            'role' => User::ROLE_RESPONSABLE,
        ]);

        $categorias = collect([
            ['name' => 'Cámara', 'color' => '#2563eb', 'sort_order' => 1],
            ['name' => 'Óptica', 'color' => '#7c3aed', 'sort_order' => 2],
            ['name' => 'Iluminación', 'color' => '#f59e0b', 'sort_order' => 3],
            ['name' => 'Sonido', 'color' => '#10b981', 'sort_order' => 4],
            ['name' => 'Grip', 'color' => '#64748b', 'sort_order' => 5],
        ])->mapWithKeys(fn (array $data) => [$data['name'] => Category::create($data)]);

        $equipos = [
            ['Cámara', 'Sony FX6', 1, 6500000, 'FX6-001'],
            ['Cámara', 'Sony A7S III', 2, 3200000, null],
            ['Óptica', 'Lente Sigma 24-70mm', 1, 3800000, 'SIG-2470'],
            ['Óptica', 'Lente 50mm f/1.4', 2, 1200000, null],
            ['Iluminación', 'Aputure 300D', 2, 2800000, null],
            ['Iluminación', 'Panel LED 1x1', 4, 900000, null],
            ['Iluminación', 'Extensión eléctrica 10m', 12, 45000, null],
            ['Sonido', 'Grabadora Zoom H6', 1, 1500000, 'ZH6-01'],
            ['Sonido', 'Micrófono boom Rode NTG4', 2, 1100000, null],
            ['Sonido', 'Lavalier inalámbrico', 6, 750000, null],
            ['Grip', 'Trípode Manfrotto', 3, 1400000, null],
            ['Grip', 'Grip clamp', 10, 85000, null],
            ['Grip', 'Batería V-Mount', 8, 650000, null],
        ];

        $items = collect($equipos)->map(fn (array $row) => Item::create([
            'category_id' => $categorias[$row[0]]->id,
            'name' => $row[1],
            'quantity' => $row[2],
            'reference_value' => $row[3],
            'code' => $row[4],
        ]));

        // Rodaje en borrador: el productor todavía está armando la lista.
        $borrador = Shoot::create([
            'name' => 'Comercial Bancolombia - Día 1',
            'project_name' => 'Campaña Ahorro 2026',
            'location' => 'Finca La Esperanza, Guatapé',
            'scheduled_date' => now()->addDays(3)->toDateString(),
            'expected_return_date' => now()->addDays(4)->toDateString(),
            'responsible_user_id' => $gaffer->id,
            'created_by_user_id' => $productor->id,
            'status' => Shoot::STATUS_DRAFT,
        ]);

        foreach ($items->take(8) as $item) {
            ShootItem::create([
                'shoot_id' => $borrador->id,
                'item_id' => $item->id,
                'quantity_planned' => min(2, $item->quantity),
            ]);
        }

        // Rodaje en campo: ya salió, todavía sin descargue.
        $enCampo = Shoot::create([
            'name' => 'Cortometraje "Niebla" - Día 2',
            'project_name' => 'Niebla',
            'location' => 'Páramo de Sumapaz',
            'scheduled_date' => now()->subDays(2)->toDateString(),
            'expected_return_date' => now()->subDay()->toDateString(),
            'responsible_user_id' => $gaffer->id,
            'created_by_user_id' => $productor->id,
            'status' => Shoot::STATUS_LOADED,
            'loaded_at' => now()->subDays(2),
        ]);

        foreach ($items->skip(4)->take(6) as $item) {
            $cantidad = min(2, $item->quantity);

            ShootItem::create([
                'shoot_id' => $enCampo->id,
                'item_id' => $item->id,
                'quantity_planned' => $cantidad,
                'quantity_loaded' => $cantidad,
                'load_status' => ShootItem::LOAD_CONFIRMED,
                'loaded_at' => now()->subDays(2),
            ]);
        }
    }
}
