<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Item extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    public const STATUS_AVAILABLE = 'available';
    public const STATUS_MAINTENANCE = 'maintenance';
    public const STATUS_LOST = 'lost';
    public const STATUS_RETIRED = 'retired';

    protected $fillable = [
        'id',
        'category_id',
        'name',
        'code',
        'serial',
        'quantity',
        'reference_value',
        'status',
        'notes',
        'is_adhoc',
        'needs_review',
        'client_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'reference_value' => 'decimal:2',
            'is_adhoc' => 'boolean',
            'needs_review' => 'boolean',
            'client_updated_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function shootItems(): HasMany
    {
        return $this->hasMany(ShootItem::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class);
    }

    public function scopeAssignable(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_AVAILABLE, self::STATUS_MAINTENANCE]);
    }

    /**
     * Unidades comprometidas en rodajes que salieron y aún no se cerraron.
     */
    public function committedQuantity(): int
    {
        return (int) $this->shootItems()
            ->whereHas('shoot', fn (Builder $q) => $q->whereIn('status', [Shoot::STATUS_LOADED]))
            ->sum('quantity_loaded');
    }

    public function availableQuantity(): int
    {
        return max(0, $this->quantity - $this->committedQuantity());
    }
}
