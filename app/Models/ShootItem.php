<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShootItem extends Model
{
    use HasFactory, HasUuids;

    public const LOAD_PENDING = 'pending';
    public const LOAD_CONFIRMED = 'confirmed';
    public const LOAD_SKIPPED = 'skipped';

    public const RETURN_PENDING = 'pending';
    public const RETURN_COMPLETE = 'complete';
    public const RETURN_PARTIAL = 'partial';
    public const RETURN_MISSING = 'missing';

    protected $fillable = [
        'id',
        'shoot_id',
        'item_id',
        'quantity_planned',
        'quantity_loaded',
        'quantity_returned',
        'quantity_damaged',
        'load_status',
        'return_status',
        'notes',
        'loaded_at',
        'returned_at',
        'was_added_in_field',
        'client_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity_planned' => 'integer',
            'quantity_loaded' => 'integer',
            'quantity_returned' => 'integer',
            'quantity_damaged' => 'integer',
            'was_added_in_field' => 'boolean',
            'loaded_at' => 'datetime',
            'returned_at' => 'datetime',
            'client_updated_at' => 'datetime',
        ];
    }

    public function shoot(): BelongsTo
    {
        return $this->belongsTo(Shoot::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function quantityMissing(): int
    {
        return max(0, $this->quantity_loaded - $this->quantity_returned - $this->quantity_damaged);
    }

    /**
     * Deriva el estado de retorno a partir de las cantidades, para que el cliente
     * y el servidor nunca queden en desacuerdo sobre qué significa "completo".
     */
    public function resolveReturnStatus(): string
    {
        if ($this->quantity_loaded === 0) {
            return self::RETURN_PENDING;
        }

        $accountedFor = $this->quantity_returned + $this->quantity_damaged;

        if ($accountedFor === 0) {
            return self::RETURN_MISSING;
        }

        if ($accountedFor >= $this->quantity_loaded) {
            return self::RETURN_COMPLETE;
        }

        return self::RETURN_PARTIAL;
    }
}
