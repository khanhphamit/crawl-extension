<?php

namespace App\Filament\Admin\Resources\VbplContents;

use App\Filament\Admin\Resources\VbplContents\Pages\CreateVbplContent;
use App\Filament\Admin\Resources\VbplContents\Pages\EditVbplContent;
use App\Filament\Admin\Resources\VbplContents\Pages\ListVbplContents;
use App\Filament\Admin\Resources\VbplContents\Schemas\VbplContentForm;
use App\Filament\Admin\Resources\VbplContents\Tables\VbplContentsTable;
use App\Models\VbplContent;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class VbplContentResource extends Resource
{
    protected static ?string $model = VbplContent::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $recordTitleAttribute = 'vbpl_id';

    public static function form(Schema $schema): Schema
    {
        return VbplContentForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return VbplContentsTable::configure($table);
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
            'index' => ListVbplContents::route('/'),
            'create' => CreateVbplContent::route('/create'),
            'edit' => EditVbplContent::route('/{record}/edit'),
        ];
    }
}
