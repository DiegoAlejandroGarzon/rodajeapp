<?php

namespace App\Services;

use App\Models\Incident;
use App\Models\Shoot;
use App\Models\ShootItem;

/**
 * El servidor es la única fuente de verdad de las incidencias: se derivan de las
 * cantidades registradas en campo. Así el cliente offline nunca crea incidencias
 * directamente y no hay conflictos que resolver sobre ellas.
 */
class IncidentReconciler
{
    public function reconcile(Shoot $shoot): void
    {
        $shoot->loadMissing('shootItems.item');

        foreach ($shoot->shootItems as $shootItem) {
            $this->syncIncident($shoot, $shootItem, Incident::TYPE_MISSING, $shootItem->quantityMissing());
            $this->syncIncident($shoot, $shootItem, Incident::TYPE_DAMAGED, $shootItem->quantity_damaged);
        }
    }

    private function syncIncident(Shoot $shoot, ShootItem $shootItem, string $type, int $quantity): void
    {
        $incident = Incident::where('shoot_id', $shoot->id)
            ->where('item_id', $shootItem->item_id)
            ->where('type', $type)
            ->first();

        if ($quantity <= 0) {
            // La cantidad se corrigió en una sincronización posterior (p. ej. el
            // equipo apareció), así que la incidencia abierta ya no aplica.
            if ($incident && $incident->status === Incident::STATUS_OPEN) {
                $incident->delete();
            }

            return;
        }

        $unitValue = $shootItem->item?->reference_value;

        if ($incident) {
            if ($incident->status === Incident::STATUS_OPEN) {
                $incident->update([
                    'quantity' => $quantity,
                    'estimated_loss' => $unitValue ? $unitValue * $quantity : null,
                    'responsible_user_id' => $shoot->responsible_user_id,
                ]);
            }

            return;
        }

        Incident::create([
            'shoot_id' => $shoot->id,
            'item_id' => $shootItem->item_id,
            'responsible_user_id' => $shoot->responsible_user_id,
            'type' => $type,
            'quantity' => $quantity,
            'estimated_loss' => $unitValue ? $unitValue * $quantity : null,
            'description' => $shootItem->notes,
            'status' => Incident::STATUS_OPEN,
        ]);
    }
}
