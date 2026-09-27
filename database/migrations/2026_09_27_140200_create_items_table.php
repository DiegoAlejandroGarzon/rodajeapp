<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('code')->nullable()->unique();
            $table->string('serial')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('reference_value', 12, 2)->nullable();
            $table->string('status')->default('available');
            $table->text('notes')->nullable();

            // Creado en campo sin conexión: el productor debe revisarlo al sincronizar.
            $table->boolean('is_adhoc')->default(false);
            $table->boolean('needs_review')->default(false);

            // Marca de tiempo del cliente, para resolver conflictos de sincronización.
            $table->timestamp('client_updated_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
