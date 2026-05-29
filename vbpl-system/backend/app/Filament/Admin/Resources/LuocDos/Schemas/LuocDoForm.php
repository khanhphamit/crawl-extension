<?php

namespace App\Filament\Admin\Resources\LuocDos\Schemas;

use Filament\Forms\Components\RichEditor;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class LuocDoForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('vbpl_id')
                    ->relationship('vbpl', 'id')
                    ->required(),
                // RichEditor::make('luoc_do_html')
                //     ->columnSpanFull()
                //     ->extraAttributes(['style' => 'min-height: 500px;'])
                //     ->helperText('Nội dung luộc đồ HTML hiển thị WYSIWYG.'),
                TextInput::make('luoc_do_links'),
                TextInput::make('vanban_bi_bai_bo'),
                TextInput::make('vanban_bai_bo'),
                TextInput::make('vanban_sua_doi'),
                TextInput::make('vanban_bi_sua_doi'),
                TextInput::make('vanban_duoc_huong_dan'),
                TextInput::make('vanban_huong_dan'),
                TextInput::make('vanban_bi_dinh_chinh'),
                TextInput::make('vanban_dinh_chinh'),
                TextInput::make('vanban_duoc_hop_nhat'),
                TextInput::make('vanban_hop_nhat'),
            ]);
    }
}
