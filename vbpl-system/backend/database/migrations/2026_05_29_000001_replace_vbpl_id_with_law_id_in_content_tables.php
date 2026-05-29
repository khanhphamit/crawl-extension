<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vbpl_contents', function (Blueprint $table) {
            $table->dropForeign(['vbpl_id']);
            $table->dropColumn('vbpl_id');
            $table->string('law_id')->nullable()->after('id');
        });

        Schema::table('luoc_dos', function (Blueprint $table) {
            $table->dropForeign(['vbpl_id']);
            $table->dropColumn('vbpl_id');
            $table->string('law_id')->nullable()->after('id');
        });

        Schema::table('vbpls', function (Blueprint $table) {
            $table->index('law_id');
        });
    }

    public function down(): void
    {
        Schema::table('vbpls', function (Blueprint $table) {
            $table->dropIndex(['law_id']);
        });

        Schema::table('vbpl_contents', function (Blueprint $table) {
            $table->dropColumn('law_id');
            $table->foreignId('vbpl_id')->nullable()->constrained('vbpls')->cascadeOnDelete();
        });

        Schema::table('luoc_dos', function (Blueprint $table) {
            $table->dropColumn('law_id');
            $table->foreignId('vbpl_id')->nullable()->constrained('vbpls')->cascadeOnDelete();
        });
    }
};
