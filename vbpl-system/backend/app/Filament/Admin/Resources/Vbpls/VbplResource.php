<?php

namespace App\Filament\Admin\Resources\Vbpls;

use App\Filament\Admin\Resources\Vbpls\Pages\CreateVbpl;
use App\Filament\Admin\Resources\Vbpls\Pages\EditVbpl;
use App\Filament\Admin\Resources\Vbpls\Pages\ListVbpls;
use App\Filament\Admin\Resources\Vbpls\Schemas\VbplForm;
use App\Filament\Admin\Resources\Vbpls\Tables\VbplsTable;
use App\Models\Vbpl;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class VbplResource extends Resource
{
    protected static ?string $model = Vbpl::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return VbplForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return VbplsTable::configure($table);
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
            'index' => ListVbpls::route('/'),
            'create' => CreateVbpl::route('/create'),
            'edit' => EditVbpl::route('/{record}/edit'),
        ];
    }
}
