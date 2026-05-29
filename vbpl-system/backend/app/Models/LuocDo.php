<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'law_id',
    'luoc_do_html',
    'luoc_do_links',
    'vanban_bi_bai_bo',
    'vanban_bai_bo',
    'vanban_sua_doi',
    'vanban_bi_sua_doi',
    'vanban_duoc_huong_dan',
    'vanban_huong_dan',
    'vanban_bi_dinh_chinh',
    'vanban_dinh_chinh',
    'vanban_duoc_hop_nhat',
    'vanban_hop_nhat',
])]
class LuocDo extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'luoc_do_links' => 'array',
            'vanban_bi_bai_bo' => 'array',
            'vanban_bai_bo' => 'array',
            'vanban_sua_doi' => 'array',
            'vanban_bi_sua_doi' => 'array',
            'vanban_duoc_huong_dan' => 'array',
            'vanban_huong_dan' => 'array',
            'vanban_bi_dinh_chinh' => 'array',
            'vanban_dinh_chinh' => 'array',
            'vanban_duoc_hop_nhat' => 'array',
            'vanban_hop_nhat' => 'array',
        ];
    }

    public function vbpl(): BelongsTo
    {
        return $this->belongsTo(Vbpl::class, 'law_id', 'law_id');
    }
}
