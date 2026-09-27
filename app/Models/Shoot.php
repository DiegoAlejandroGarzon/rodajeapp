<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Shoot extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_LOADED = 'loaded';
    public const STATUS_RETURNED = 'returned';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'id',
        'name',
        'project_name',
        'location',
        'scheduled_date',
        'expected_return_date',
        'responsible_user_id',
        'created_by_user_id',
        'status',
        'notes',
        'loaded_at',
        'returned_at',
        'closed_at',
        'client_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'expected_return_date' => 'date',
            'loaded_at' => 'datetime',
            'returned_at' => 'datetime',
            'closed_at' => 'datetime',
            'client_updated_at' => 'datetime',
        ];
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function shootItems(): HasMany
    {
        return $this->hasMany(ShootItem::class);
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class);
    }

    /**
     * Un rodaje se descarga en campo, así que el cliente necesita saber si
     * todavía admite escrituras offline.
     */
    public function isEditableInField(): bool
    {
        return in_array($this->status, [self::STATUS_DRAFT, self::STATUS_LOADED, self::STATUS_RETURNED], true);
    }
}
