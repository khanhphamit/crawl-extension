<?php

namespace App\Filament\Admin\Resources\LuocDos\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class LuocDosTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('vbpl.id')
                    ->searchable(),
                TextColumn::make('vanban_bi_bai_bo')
                    ->searchable()
                    ->label('VB bị bãi bỏ'),
                TextColumn::make('vanban_bai_bo')
                    ->searchable()
                    ->label('VB bãi bỏ'),
                TextColumn::make('vanban_sua_doi')
                    ->searchable()
                    ->label('VB sửa đổi'),
                TextColumn::make('vanban_bi_sua_doi')
                    ->searchable()
                    ->label('VB bị sửa đổi'),
                TextColumn::make('vanban_duoc_huong_dan')
                    ->searchable()
                    ->label('VB được hướng dẫn'),
                TextColumn::make('vanban_huong_dan')
                    ->searchable()
                    ->label('VB hướng dẫn'),
                TextColumn::make('vanban_bi_dinh_chinh')
                    ->searchable()
                    ->label('VB bị đính chính'),
                TextColumn::make('vanban_dinh_chinh')
                    ->searchable()
                    ->label('VB đính chính'),
                TextColumn::make('vanban_duoc_hop_nhat')
                    ->searchable()
                    ->label('VB được hợp nhất'),
                TextColumn::make('vanban_hop_nhat')
                    ->searchable()
                    ->label('VB hợp nhất'),
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
