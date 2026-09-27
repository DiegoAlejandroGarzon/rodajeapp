<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncOperation extends Model
{
    use HasUuids;

    public const RESULT_APPLIED = 'applied';
    public const RESULT_SKIPPED_STALE = 'skipped_stale';
    public const RESULT_CONFLICT = 'conflict';
    public const RESULT_FAILED = 'failed';

    protected $fillable = [
        'id',
        'user_id',
        'device_id',
        'entity',
        'entity_id',
        'action',
        'payload',
        'result',
        'message',
        'client_created_at',
        'applied_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'client_created_at' => 'datetime',
            'applied_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
