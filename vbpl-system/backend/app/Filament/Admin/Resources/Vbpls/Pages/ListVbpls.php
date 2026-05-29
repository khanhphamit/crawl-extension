<?php

namespace App\Filament\Admin\Resources\Vbpls\Pages;

use App\Filament\Admin\Resources\Vbpls\VbplResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListVbpls extends ListRecords
{
    protected static string $resource = VbplResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
