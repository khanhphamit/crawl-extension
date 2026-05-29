<?php

namespace App\Filament\Admin\Resources\VbplContents\Schemas;

use Filament\Forms\Components\RichEditor;
use Filament\Forms\Components\Select;
use Filament\Schemas\Schema;

class VbplContentForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('law_id')
                    ->relationship('vbpl', 'law_id')
                    ->required(),
                RichEditor::make('content')
                    ->columnSpanFull()
                    ->extraAttributes(['style' => 'min-height: 500px;'])
                    ->helperText('Nội dung HTML sẽ hiển thị dưới dạng WYSIWYG.'),
            ]);
    }
}
