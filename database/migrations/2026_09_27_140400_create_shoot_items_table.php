<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shoot_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('shoot_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('item_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('quantity_planned')->default(1);
            $table->unsignedInteger('quantity_loaded')->default(0);
            $table->unsignedInteger('quantity_returned')->default(0);
            $table->unsignedInteger('quantity_damaged')->default(0);

            // pending -> confirmed | skipped
            $table->string('load_status')->default('pending');
            // pending -> complete | partial | missing
            $table->string('return_status')->default('pending');

            $table->text('notes')->nullable();
            $table->timestamp('loaded_at')->nullable();
            $table->timestamp('returned_at')->nullable();

            // Agregado en locación, fuera de la lista planificada.
            $table->boolean('was_added_in_field')->default(false);

            $table->timestamp('client_updated_at')->nullable();

            $table->timestamps();

            $table->unique(['shoot_id', 'item_id']);
            $table->index('return_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shoot_items');
    }
};
