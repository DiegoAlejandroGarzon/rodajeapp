<?php

namespace App\Services;

use App\Models\Item;
use App\Models\Shoot;
use App\Models\ShootItem;
use App\Models\SyncOperation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class SyncService
{
    public function __construct(private readonly IncidentReconciler $reconciler)
    {
    }

    /**
     * Aplica un lote de operaciones generadas sin conexión.
     *
     * @param  array<int, array<string, mixed>>  $operations
     * @return array{results: array<int, array<string, mixed>>, shoot_ids: array<int, string>}
     */
    public function push(User $user, ?string $deviceId, array $operations): array
    {
        $results = [];
        $touchedShootIds = [];

        // El cliente encola en orden cronológico, pero la red puede reordenar el
        // lote; ordenamos para que las escrituras se apliquen como ocurrieron.
        usort($operations, fn (array $a, array $b) => ($a['client_created_at'] ?? '') <=> ($b['client_created_at'] ?? ''));

        foreach ($operations as $operation) {
            $alreadyProcessed = SyncOperation::find($operation['id']);

            if ($alreadyProcessed) {
                // Aunque no se reaplique, el cliente sigue necesitando el estado
                // fresco del rodaje: el reintento suele venir de una red que cortó
                // antes de que le llegara la respuesta anterior.
                if ($shootId = $this->resolveShootId($alreadyProcessed->entity, $alreadyProcessed->entity_id)) {
                    $touchedShootIds[$shootId] = true;
                }

                $results[] = [
                    'operation_id' => $operation['id'],
                    'result' => $alreadyProcessed->result,
                    'message' => 'Operación ya procesada anteriormente.',
                ];

                continue;
            }

            try {
                $outcome = DB::transaction(fn () => $this->apply($user, $operation));
            } catch (Throwable $exception) {
                $outcome = [
                    'result' => SyncOperation::RESULT_FAILED,
                    'message' => $exception->getMessage(),
                ];
            }

            if (isset($outcome['shoot_id'])) {
                $touchedShootIds[$outcome['shoot_id']] = true;
            }

            SyncOperation::create([
                'id' => $operation['id'],
                'user_id' => $user->id,
                'device_id' => $deviceId,
                'entity' => $operation['entity'],
                'entity_id' => $operation['entity_id'],
                'action' => $operation['action'],
                'payload' => $operation['payload'] ?? [],
                'result' => $outcome['result'],
                'message' => $outcome['message'] ?? null,
                'client_created_at' => $operation['client_created_at'] ?? null,
                'applied_at' => $outcome['result'] === SyncOperation::RESULT_APPLIED ? now() : null,
            ]);

            $results[] = [
                'operation_id' => $operation['id'],
                'result' => $outcome['result'],
                'message' => $outcome['message'] ?? null,
            ];
        }

        $shootIds = array_keys($touchedShootIds);

        // Las incidencias se recalculan una sola vez por rodaje al final del lote,
        // cuando todas las cantidades del descargue ya están aplicadas.
        foreach ($shootIds as $shootId) {
            $shoot = Shoot::with('shootItems.item')->find($shootId);

            if ($shoot && in_array($shoot->status, [Shoot::STATUS_RETURNED, Shoot::STATUS_CLOSED], true)) {
                $this->reconciler->reconcile($shoot);
            }
        }

        return ['results' => $results, 'shoot_ids' => $shootIds];
    }

    /**
     * @param  array<string, mixed>  $operation
     * @return array<string, mixed>
     */
    private function apply(User $user, array $operation): array
    {
        return match ($operation['entity']) {
            'item' => $this->applyItem($operation),
            'shoot' => $this->applyShoot($user, $operation),
            'shoot_item' => $this->applyShootItem($operation),
            default => throw new RuntimeException("Entidad no sincronizable: {$operation['entity']}"),
        };
    }

    /**
     * @param  array<string, mixed>  $operation
     * @return array<string, mixed>
     */
    private function applyItem(array $operation): array
    {
        $payload = $operation['payload'] ?? [];
        $item = Item::find($operation['entity_id']);

        if (! $item) {
            if ($operation['action'] !== 'create') {
                throw new RuntimeException('El equipo no existe en el servidor.');
            }

            Item::create([
                'id' => $operation['entity_id'],
                'category_id' => $payload['category_id'] ?? null,
                'name' => $payload['name'],
                'quantity' => $payload['quantity'] ?? 1,
                'serial' => $payload['serial'] ?? null,
                'notes' => $payload['notes'] ?? null,
                'status' => Item::STATUS_AVAILABLE,
                // Creado en locación: el productor lo revisa antes de darlo por bueno.
                'is_adhoc' => true,
                'needs_review' => true,
                'client_updated_at' => $payload['client_updated_at'] ?? null,
            ]);

            return ['result' => SyncOperation::RESULT_APPLIED];
        }

        if ($this->isStale($item->client_updated_at, $payload['client_updated_at'] ?? null)) {
            return [
                'result' => SyncOperation::RESULT_SKIPPED_STALE,
                'message' => 'El servidor tiene una versión más reciente de este equipo.',
            ];
        }

        $item->update(array_filter([
            'name' => $payload['name'] ?? null,
            'quantity' => $payload['quantity'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'client_updated_at' => $payload['client_updated_at'] ?? null,
        ], fn ($value) => $value !== null));

        return ['result' => SyncOperation::RESULT_APPLIED];
    }

    /**
     * @param  array<string, mixed>  $operation
     * @return array<string, mixed>
     */
    private function applyShoot(User $user, array $operation): array
    {
        $payload = $operation['payload'] ?? [];
        $shoot = Shoot::find($operation['entity_id']);

        if (! $shoot) {
            throw new RuntimeException('El rodaje no existe en el servidor.');
        }

        if (! $shoot->isEditableInField()) {
            return [
                'result' => SyncOperation::RESULT_CONFLICT,
                'message' => 'El rodaje ya fue cerrado en el servidor y no admite cambios desde el celular.',
                'shoot_id' => $shoot->id,
            ];
        }

        if ($shoot->responsible_user_id !== $user->id && ! $user->isAdmin()) {
            throw new RuntimeException('No eres el responsable de este rodaje.');
        }

        if ($this->isStale($shoot->client_updated_at, $payload['client_updated_at'] ?? null)) {
            return [
                'result' => SyncOperation::RESULT_SKIPPED_STALE,
                'message' => 'El servidor tiene una versión más reciente de este rodaje.',
                'shoot_id' => $shoot->id,
            ];
        }

        $allowedStatuses = [Shoot::STATUS_LOADED, Shoot::STATUS_RETURNED];
        $status = $payload['status'] ?? null;

        if ($status !== null && ! in_array($status, $allowedStatuses, true)) {
            throw new RuntimeException("El estado '{$status}' no se puede establecer desde el celular.");
        }

        $shoot->update(array_filter([
            'status' => $status,
            'notes' => $payload['notes'] ?? null,
            'loaded_at' => $payload['loaded_at'] ?? null,
            'returned_at' => $payload['returned_at'] ?? null,
            'client_updated_at' => $payload['client_updated_at'] ?? null,
        ], fn ($value) => $value !== null));

        return ['result' => SyncOperation::RESULT_APPLIED, 'shoot_id' => $shoot->id];
    }

    /**
     * @param  array<string, mixed>  $operation
     * @return array<string, mixed>
     */
    private function applyShootItem(array $operation): array
    {
        $payload = $operation['payload'] ?? [];
        $shootItem = ShootItem::find($operation['entity_id']);

        if (! $shootItem) {
            if ($operation['action'] !== 'create') {
                throw new RuntimeException('El renglón del rodaje no existe en el servidor.');
            }

            $shoot = Shoot::find($payload['shoot_id'] ?? null);

            if (! $shoot) {
                throw new RuntimeException('El rodaje del renglón no existe en el servidor.');
            }

            if (! Item::withTrashed()->whereKey($payload['item_id'] ?? null)->exists()) {
                throw new RuntimeException('El equipo del renglón no existe en el servidor.');
            }

            $shootItem = ShootItem::create([
                'id' => $operation['entity_id'],
                'shoot_id' => $shoot->id,
                'item_id' => $payload['item_id'],
                'quantity_planned' => $payload['quantity_planned'] ?? 0,
                'quantity_loaded' => $payload['quantity_loaded'] ?? 0,
                'quantity_returned' => $payload['quantity_returned'] ?? 0,
                'quantity_damaged' => $payload['quantity_damaged'] ?? 0,
                'load_status' => $payload['load_status'] ?? ShootItem::LOAD_PENDING,
                'notes' => $payload['notes'] ?? null,
                'loaded_at' => $payload['loaded_at'] ?? null,
                'returned_at' => $payload['returned_at'] ?? null,
                'was_added_in_field' => true,
                'client_updated_at' => $payload['client_updated_at'] ?? null,
            ]);

            $shootItem->update(['return_status' => $shootItem->resolveReturnStatus()]);

            return ['result' => SyncOperation::RESULT_APPLIED, 'shoot_id' => $shoot->id];
        }

        if ($this->isStale($shootItem->client_updated_at, $payload['client_updated_at'] ?? null)) {
            return [
                'result' => SyncOperation::RESULT_SKIPPED_STALE,
                'message' => 'El servidor tiene un registro más reciente de este equipo en el rodaje.',
                'shoot_id' => $shootItem->shoot_id,
            ];
        }

        $shootItem->fill(array_filter([
            'quantity_loaded' => $payload['quantity_loaded'] ?? null,
            'quantity_returned' => $payload['quantity_returned'] ?? null,
            'quantity_damaged' => $payload['quantity_damaged'] ?? null,
            'load_status' => $payload['load_status'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'loaded_at' => $payload['loaded_at'] ?? null,
            'returned_at' => $payload['returned_at'] ?? null,
            'client_updated_at' => $payload['client_updated_at'] ?? null,
        ], fn ($value) => $value !== null));

        $this->guardQuantities($shootItem);

        $shootItem->return_status = $shootItem->resolveReturnStatus();
        $shootItem->save();

        return ['result' => SyncOperation::RESULT_APPLIED, 'shoot_id' => $shootItem->shoot_id];
    }

    private function resolveShootId(string $entity, string $entityId): ?string
    {
        return match ($entity) {
            'shoot' => $entityId,
            'shoot_item' => ShootItem::whereKey($entityId)->value('shoot_id'),
            default => null,
        };
    }

    private function guardQuantities(ShootItem $shootItem): void
    {
        $accountedFor = $shootItem->quantity_returned + $shootItem->quantity_damaged;

        if ($accountedFor > $shootItem->quantity_loaded) {
            throw new RuntimeException(
                'Las cantidades devueltas y dañadas suman más de lo que salió a rodaje.'
            );
        }
    }

    /**
     * Última escritura gana: si la marca de tiempo del cliente es anterior a la ya
     * registrada, el cambio llegó tarde y se descarta en lugar de pisar datos nuevos.
     */
    private function isStale(?\DateTimeInterface $storedAt, ?string $incomingAt): bool
    {
        if ($storedAt === null || $incomingAt === null) {
            return false;
        }

        return CarbonImmutable::parse($incomingAt)->lessThan($storedAt);
    }
}
