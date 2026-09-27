<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incidents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('shoot_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('responsible_user_id')->constrained('users');

            // missing | damaged
            $table->string('type');
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('estimated_loss', 12, 2)->nullable();
            $table->text('description')->nullable();

            // open | resolved | written_off
            $table->string('status')->default('open');
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable();

            $table->timestamp('client_updated_at')->nullable();

            $table->timestamps();

            $table->index(['responsible_user_id', 'status']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incidents');
    }
};
