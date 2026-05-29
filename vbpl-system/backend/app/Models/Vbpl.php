<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'law_id',
    'name',
    'so_hieu',
    'loai_van_ban',
    'noi_ban_hanh',
    'ngay_ban_hanh',
    'ngay_hieu_luc',
    'ngay_cap_nhat',
    'tinh_trang_hieu_luc',
    'source_url',
])]
class Vbpl extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'ngay_ban_hanh' => 'date',
            'ngay_hieu_luc' => 'date',
            'ngay_cap_nhat' => 'date',
        ];
    }

    public function contents(): HasMany
    {
        return $this->hasMany(VbplContent::class);
    }

    public function luocDo(): HasOne
    {
        return $this->hasOne(LuocDo::class);
    }
}
