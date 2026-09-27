<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\Item;
use App\Models\Shoot;
use App\Models\ShootItem;
use App\Models\SyncOperation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SyncTest extends TestCase
{
    use RefreshDatabase;

    private User $responsable;

    private Shoot $shoot;

    private Item $item;

    protected function setUp(): void
    {
        parent::setUp();

        $this->responsable = User::factory()->create(['role' => User::ROLE_RESPONSABLE]);

        $this->shoot = Shoot::factory()->loaded()->create([
            'responsible_user_id' => $this->responsable->id,
        ]);

        $this->item = Item::factory()->create([
            'quantity' => 5,
            'reference_value' => 100_000,
        ]);

        Sanctum::actingAs($this->responsable);
    }

    private function operation(array $overrides = []): array
    {
        return array_merge([
            'id' => (string) Str::uuid(),
            'entity' => 'shoot_item',
            'entity_id' => (string) Str::uuid(),
            'action' => 'update',
            'client_created_at' => now()->toIso8601String(),
            'payload' => [],
        ], $overrides);
    }

    public function test_registra_el_descargue_y_calcula_el_faltante(): void
    {
        $shootItem = ShootItem::factory()->loaded(3)->create([
            'shoot_id' => $this->shoot->id,
            'item_id' => $this->item->id,
        ]);

        $response = $this->postJson('/api/sync/push', [
            'device_id' => 'celular-productor',
            'operations' => [
                $this->operation([
                    'entity_id' => $shootItem->id,
                    'payload' => [
                        'quantity_returned' => 2,
                        'quantity_damaged' => 0,
                        'client_updated_at' => now()->toIso8601String(),
                    ],
                ]),
                $this->operation([
                    'entity' => 'shoot',
                    'entity_id' => $this->shoot->id,
                    'payload' => [
                        'status' => Shoot::STATUS_RETURNED,
                        'returned_at' => now()->toIso8601String(),
                        'client_updated_at' => now()->toIso8601String(),
                    ],
                ]),
            ],
        ]);

        $response->assertOk();
        $this->assertSame(
            [SyncOperation::RESULT_APPLIED, SyncOperation::RESULT_APPLIED],
            array_column($response->json('results'), 'result'),
        );

        $shootItem->refresh();
        $this->assertSame(2, $shootItem->quantity_returned);
        $this->assertSame(1, $shootItem->quantityMissing());
        $this->assertSame(ShootItem::RETURN_PARTIAL, $shootItem->return_status);

        // La incidencia la deriva el servidor, no el cliente.
        $incident = Incident::where('shoot_id', $this->shoot->id)->firstOrFail();
        $this->assertSame(Incident::TYPE_MISSING, $incident->type);
        $this->assertSame(1, $incident->quantity);
        $this->assertSame('100000.00', $incident->estimated_loss);
        $this->assertSame($this->responsable->id, $incident->responsible_user_id);
    }

    public function test_reenviar_el_mismo_lote_no_duplica_los_cambios(): void
    {
        $shootItem = ShootItem::factory()->loaded(3)->create([
            'shoot_id' => $this->shoot->id,
            'item_id' => $this->item->id,
        ]);

        $payload = [
            'device_id' => 'celular-productor',
            'operations' => [
                $this->operation([
                    'entity_id' => $shootItem->id,
                    'payload' => ['quantity_returned' => 2],
                ]),
            ],
        ];

        $this->postJson('/api/sync/push', $payload)->assertOk();
        $segundoIntento = $this->postJson('/api/sync/push', $payload)->assertOk();

        $this->assertSame(
            SyncOperation::RESULT_APPLIED,
            $segundoIntento->json('results.0.result'),
        );
        $this->assertSame(1, SyncOperation::count());
        $this->assertSame(2, $shootItem->fresh()->quantity_returned);
    }

    public function test_descarta_un_cambio_mas_viejo_que_el_del_servidor(): void
    {
        $shootItem = ShootItem::factory()->loaded(3)->create([
            'shoot_id' => $this->shoot->id,
            'item_id' => $this->item->id,
            'quantity_returned' => 3,
            'client_updated_at' => now(),
        ]);

        $response = $this->postJson('/api/sync/push', [
            'operations' => [
                $this->operation([
                    'entity_id' => $shootItem->id,
                    'payload' => [
                        'quantity_returned' => 1,
                        'client_updated_at' => now()->subHour()->toIso8601String(),
                    ],
                ]),
            ],
        ]);

        $response->assertOk();
        $this->assertSame(SyncOperation::RESULT_SKIPPED_STALE, $response->json('results.0.result'));
        $this->assertSame(3, $shootItem->fresh()->quantity_returned);
    }

    public function test_rechaza_devolver_mas_de_lo_que_salio(): void
    {
        $shootItem = ShootItem::factory()->loaded(2)->create([
            'shoot_id' => $this->shoot->id,
            'item_id' => $this->item->id,
        ]);

        $response = $this->postJson('/api/sync/push', [
            'operations' => [
                $this->operation([
                    'entity_id' => $shootItem->id,
                    'payload' => ['quantity_returned' => 5],
                ]),
            ],
        ]);

        $response->assertOk();
        $this->assertSame(SyncOperation::RESULT_FAILED, $response->json('results.0.result'));
        $this->assertSame(0, $shootItem->fresh()->quantity_returned);
    }

    public function test_permite_agregar_un_equipo_ad_hoc_desde_el_campo(): void
    {
        $nuevoItemId = (string) Str::uuid();
        $nuevoShootItemId = (string) Str::uuid();

        $response = $this->postJson('/api/sync/push', [
            'operations' => [
                $this->operation([
                    'entity' => 'item',
                    'entity_id' => $nuevoItemId,
                    'action' => 'create',
                    'client_created_at' => now()->subMinute()->toIso8601String(),
                    'payload' => ['name' => 'Trípode extra', 'quantity' => 1],
                ]),
                $this->operation([
                    'entity_id' => $nuevoShootItemId,
                    'action' => 'create',
                    'payload' => [
                        'shoot_id' => $this->shoot->id,
                        'item_id' => $nuevoItemId,
                        'quantity_loaded' => 1,
                        'quantity_returned' => 1,
                    ],
                ]),
            ],
        ]);

        $response->assertOk();
        $this->assertSame(
            [SyncOperation::RESULT_APPLIED, SyncOperation::RESULT_APPLIED],
            array_column($response->json('results'), 'result'),
        );

        // Un equipo creado en locación queda marcado para revisión del productor.
        $item = Item::findOrFail($nuevoItemId);
        $this->assertTrue($item->is_adhoc);
        $this->assertTrue($item->needs_review);

        $shootItem = ShootItem::findOrFail($nuevoShootItemId);
        $this->assertTrue($shootItem->was_added_in_field);
        $this->assertSame(ShootItem::RETURN_COMPLETE, $shootItem->return_status);
    }

    public function test_no_acepta_cambios_sobre_un_rodaje_ya_cerrado(): void
    {
        $this->shoot->update(['status' => Shoot::STATUS_CLOSED, 'closed_at' => now()]);

        $response = $this->postJson('/api/sync/push', [
            'operations' => [
                $this->operation([
                    'entity' => 'shoot',
                    'entity_id' => $this->shoot->id,
                    'payload' => ['status' => Shoot::STATUS_RETURNED],
                ]),
            ],
        ]);

        $response->assertOk();
        $this->assertSame(SyncOperation::RESULT_CONFLICT, $response->json('results.0.result'));
        $this->assertSame(Shoot::STATUS_CLOSED, $this->shoot->fresh()->status);
    }

    public function test_la_incidencia_se_cierra_si_el_equipo_aparece_despues(): void
    {
        $shootItem = ShootItem::factory()->loaded(2)->create([
            'shoot_id' => $this->shoot->id,
            'item_id' => $this->item->id,
        ]);
        $this->shoot->update(['status' => Shoot::STATUS_RETURNED]);

        $this->postJson('/api/sync/push', [
            'operations' => [
                $this->operation([
                    'entity_id' => $shootItem->id,
                    'payload' => ['quantity_returned' => 1, 'client_updated_at' => now()->toIso8601String()],
                ]),
            ],
        ])->assertOk();

        $this->assertSame(1, Incident::where('shoot_id', $this->shoot->id)->count());

        // Segunda sincronización: el equipo faltante apareció.
        $this->postJson('/api/sync/push', [
            'operations' => [
                $this->operation([
                    'entity_id' => $shootItem->id,
                    'payload' => ['quantity_returned' => 2, 'client_updated_at' => now()->addHour()->toIso8601String()],
                ]),
            ],
        ])->assertOk();

        $this->assertSame(0, Incident::where('shoot_id', $this->shoot->id)->count());
    }

    public function test_el_bootstrap_solo_entrega_los_rodajes_del_responsable(): void
    {
        $otroRodaje = Shoot::factory()->loaded()->create();

        $response = $this->getJson('/api/sync/bootstrap')->assertOk();

        $ids = array_column($response->json('shoots'), 'id');
        $this->assertContains($this->shoot->id, $ids);
        $this->assertNotContains($otroRodaje->id, $ids);
    }
}
