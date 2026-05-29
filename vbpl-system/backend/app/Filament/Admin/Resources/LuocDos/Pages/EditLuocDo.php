<?php

namespace App\Filament\Admin\Resources\LuocDos\Pages;

use App\Filament\Admin\Resources\LuocDos\LuocDoResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditLuocDo extends EditRecord
{
    protected static string $resource = LuocDoResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
