<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shoots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('project_name')->nullable();
            $table->string('location')->nullable();
            $table->date('scheduled_date');
            $table->date('expected_return_date')->nullable();

            $table->foreignId('responsible_user_id')->constrained('users');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();

            // draft -> loaded -> returned -> closed
            $table->string('status')->default('draft');

            $table->text('notes')->nullable();
            $table->timestamp('loaded_at')->nullable();
            $table->timestamp('returned_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->timestamp('client_updated_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('scheduled_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shoots');
    }
};
