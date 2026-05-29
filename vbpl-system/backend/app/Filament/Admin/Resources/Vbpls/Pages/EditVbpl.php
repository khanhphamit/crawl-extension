<?php

namespace App\Filament\Admin\Resources\Vbpls\Pages;

use App\Filament\Admin\Resources\Vbpls\VbplResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditVbpl extends EditRecord
{
    protected static string $resource = VbplResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
