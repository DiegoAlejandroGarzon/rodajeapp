<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_operations', function (Blueprint $table) {
            // El id lo genera el cliente: si reenvía el mismo lote, la operación no se repite.
            $table->uuid('id')->primary();

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_id')->nullable();

            $table->string('entity');
            $table->string('entity_id');
            $table->string('action');
            $table->json('payload');

            // applied | skipped_stale | conflict | failed
            $table->string('result');
            $table->text('message')->nullable();

            $table->timestamp('client_created_at')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();

            $table->index(['entity', 'entity_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_operations');
    }
};
