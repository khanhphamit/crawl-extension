<?php

namespace App\Filament\Admin\Resources\LuocDos\Exports;

use App\Models\LuocDo;
use Filament\Actions\Exports\ExportColumn;
use Filament\Actions\Exports\Exporter;
use Filament\Actions\Exports\Enums\ExportFormat;
use Filament\Actions\Exports\Models\Export;

class LuocDoExporter extends Exporter
{
    protected static ?string $model = LuocDo::class;

    public static function getColumns(): array
    {
        return [
            ExportColumn::make('vbpl.id')->label('VBPL ID'),
            ExportColumn::make('vanban_bi_bai_bo')->label('VB bị bãi bỏ'),
            ExportColumn::make('vanban_bai_bo')->label('VB bãi bỏ'),
            ExportColumn::make('vanban_sua_doi')->label('VB sửa đổi'),
            ExportColumn::make('vanban_bi_sua_doi')->label('VB bị sửa đổi'),
            ExportColumn::make('vanban_duoc_huong_dan')->label('VB được hướng dẫn'),
            ExportColumn::make('vanban_huong_dan')->label('VB hướng dẫn'),
            ExportColumn::make('vanban_bi_dinh_chinh')->label('VB bị đính chính'),
            ExportColumn::make('vanban_dinh_chinh')->label('VB đính chính'),
            ExportColumn::make('vanban_duoc_hop_nhat')->label('VB được hợp nhất'),
            ExportColumn::make('vanban_hop_nhat')->label('VB hợp nhất'),
            ExportColumn::make('created_at')->label('Created At'),
            ExportColumn::make('updated_at')->label('Updated At'),
        ];
    }

    public static function getCompletedNotificationBody(Export $export): string
    {
        return __('The export has completed.');
    }

    public function getFormats(): array
    {
        return [ExportFormat::Xlsx];
    }

    public function getFileName(Export $export): string
    {
        return 'luocdos_export';
    }
}
