<?php

namespace App\Filament\Admin\Resources\VbplContents\Pages;

use App\Filament\Admin\Resources\VbplContents\VbplContentResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditVbplContent extends EditRecord
{
    protected static string $resource = VbplContentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
