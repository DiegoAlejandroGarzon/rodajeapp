<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Incident extends Model
{
    use HasUuids;

    public const TYPE_MISSING = 'missing';
    public const TYPE_DAMAGED = 'damaged';

    public const STATUS_OPEN = 'open';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_WRITTEN_OFF = 'written_off';

    protected $fillable = [
        'id',
        'shoot_id',
        'item_id',
        'responsible_user_id',
        'type',
        'quantity',
        'estimated_loss',
        'description',
        'status',
        'resolved_at',
        'resolution_notes',
        'client_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'estimated_loss' => 'decimal:2',
            'resolved_at' => 'datetime',
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

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_OPEN);
    }
}
