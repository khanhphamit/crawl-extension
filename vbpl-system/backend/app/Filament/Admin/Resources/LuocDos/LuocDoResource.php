<?php

namespace App\Filament\Admin\Resources\LuocDos;

use App\Filament\Admin\Resources\LuocDos\Pages\CreateLuocDo;
use App\Filament\Admin\Resources\LuocDos\Pages\EditLuocDo;
use App\Filament\Admin\Resources\LuocDos\Pages\ListLuocDos;
use App\Filament\Admin\Resources\LuocDos\Schemas\LuocDoForm;
use App\Filament\Admin\Resources\LuocDos\Tables\LuocDosTable;
use App\Models\LuocDo;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class LuocDoResource extends Resource
{
    protected static ?string $model = LuocDo::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $recordTitleAttribute = 'vbpl_id';

    public static function form(Schema $schema): Schema
    {
        return LuocDoForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return LuocDosTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListLuocDos::route('/'),
            'create' => CreateLuocDo::route('/create'),
            'edit' => EditLuocDo::route('/{record}/edit'),
        ];
    }
}
