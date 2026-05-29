<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['vbpl_id', 'content'])]
class VbplContent extends Model
{
    use HasFactory;

    public function vbpl(): BelongsTo
    {
        return $this->belongsTo(Vbpl::class);
    }
}
