<?php

namespace App\Filament\Admin\Resources\Vbpls\Schemas;

use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class VbplForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('so_hieu'),
                TextInput::make('loai_van_ban'),
                TextInput::make('noi_ban_hanh'),
                DatePicker::make('ngay_ban_hanh'),
                DatePicker::make('ngay_hieu_luc'),
                DatePicker::make('ngay_cap_nhat'),
                TextInput::make('tinh_trang_hieu_luc'),
                TextInput::make('source_url')
                    ->url(),
            ]);
    }
}
