<?php

namespace App\Filament\Admin\Resources\VbplContents\Pages;

use App\Filament\Admin\Resources\VbplContents\VbplContentResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListVbplContents extends ListRecords
{
    protected static string $resource = VbplContentResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
