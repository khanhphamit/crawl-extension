<?php

namespace App\Filament\Admin\Resources\Vbpls\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class VbplsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('law_id')
                    ->label('Law ID')
                    ->searchable(),
                TextColumn::make('name')
                    ->label('Name')
                    ->searchable(),
                TextColumn::make('so_hieu')
                    ->searchable(),
                TextColumn::make('loai_van_ban')
                    ->searchable(),
                TextColumn::make('noi_ban_hanh')
                    ->searchable(),
                TextColumn::make('ngay_ban_hanh')
                    ->date()
                    ->sortable(),
                TextColumn::make('ngay_hieu_luc')
                    ->date()
                    ->sortable(),
                TextColumn::make('ngay_cap_nhat')
                    ->date()
                    ->sortable(),
                TextColumn::make('tinh_trang_hieu_luc')
                    ->searchable(),
                TextColumn::make('source_url')
                    ->searchable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
