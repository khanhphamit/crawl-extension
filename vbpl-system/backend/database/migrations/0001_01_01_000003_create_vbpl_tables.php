<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vbpls', function (Blueprint $table) {
            $table->id();
            $table->string('law_id')->nullable();
            $table->string('name')->nullable();
            $table->string('so_hieu')->nullable();
            $table->string('loai_van_ban')->nullable();
            $table->string('noi_ban_hanh')->nullable();
            $table->date('ngay_ban_hanh')->nullable();
            $table->date('ngay_hieu_luc')->nullable();
            $table->date('ngay_cap_nhat')->nullable();
            $table->string('tinh_trang_hieu_luc')->nullable();
            $table->string('source_url')->nullable();
            $table->timestamps();
        });

        Schema::create('vbpl_contents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vbpl_id')->constrained('vbpls')->cascadeOnDelete();
            $table->longText('content')->nullable();
            $table->timestamps();
        });

        Schema::create('luoc_dos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vbpl_id')->constrained('vbpls')->cascadeOnDelete();
            $table->longText('luoc_do_html')->nullable();
            $table->json('luoc_do_links')->nullable();
            $table->json('vanban_bi_bai_bo')->nullable();
            $table->json('vanban_bai_bo')->nullable();
            $table->json('vanban_sua_doi')->nullable();
            $table->json('vanban_bi_sua_doi')->nullable();
            $table->json('vanban_duoc_huong_dan')->nullable();
            $table->json('vanban_huong_dan')->nullable();
            $table->json('vanban_bi_dinh_chinh')->nullable();
            $table->json('vanban_dinh_chinh')->nullable();
            $table->json('vanban_duoc_hop_nhat')->nullable();
            $table->json('vanban_hop_nhat')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('luoc_dos');
        Schema::dropIfExists('vbpl_contents');
        Schema::dropIfExists('vbpls');
    }
};
