<?php

namespace App\Filament\Admin\Resources\LuocDos\Pages;

use App\Filament\Admin\Resources\LuocDos\Exports\LuocDoExporter;
use App\Filament\Admin\Resources\LuocDos\LuocDoResource;
use Filament\Actions\CreateAction;
use Filament\Actions\ExportAction;
use Filament\Actions\Exports\Enums\ExportFormat;
use Filament\Resources\Pages\ListRecords;

class ListLuocDos extends ListRecords
{
    protected static string $resource = LuocDoResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
            ExportAction::make()
                ->exporter(LuocDoExporter::class)
                ->formats([ExportFormat::Xlsx])
                ->fileName('luocdos_export'),
        ];
    }
}
