<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LuocDo;
use App\Models\Vbpl;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CrawlController extends Controller
{
    private function parseDate(?string $value): ?string
    {
        if (!$value) {
            return null;
        }

        $value = trim($value);

        try {
            return Carbon::createFromFormat('d/m/Y', $value)->format('Y-m-d');
        } catch (\Throwable $e) {
            try {
                return Carbon::parse($value)->format('Y-m-d');
            } catch (\Throwable $e) {
                return null;
            }
        }
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'items' => ['required', 'array'],
            'items.*.law_id' => ['nullable', 'string'],
            'items.*.name' => ['nullable', 'string'],
            'items.*.so_hieu' => ['nullable', 'string'],
            'items.*.loai_van_ban' => ['nullable', 'string'],
            'items.*.noi_ban_hanh' => ['nullable', 'string'],
            'items.*.ngay_ban_hanh' => ['nullable', 'string'],
            'items.*.ngay_co_hieu_luc' => ['nullable', 'string'],
            'items.*.ngay_hieu_luc' => ['nullable', 'string'],
            'items.*.ngay_cap_nhat' => ['nullable', 'string'],
            'items.*.tinh_trang_hieu_luc' => ['nullable', 'string'],
            'items.*.source_url' => ['nullable', 'string'],
            'items.*.content' => ['nullable', 'string'],
            'items.*.luoc_do_html' => ['nullable', 'string'],
            'items.*.luoc_do_links' => ['nullable', 'array'],
            'items.*.luoc_do_links.*' => ['string'],
            'items.*.vanbanBiBaiBo' => ['nullable', 'array'],
            'items.*.vanbanBiBaiBo.*' => ['string'],
            'items.*.vanbanBaiBo' => ['nullable', 'array'],
            'items.*.vanbanBaiBo.*' => ['string'],
            'items.*.vanbanSuaDoi' => ['nullable', 'array'],
            'items.*.vanbanSuaDoi.*' => ['string'],
            'items.*.vanbanBiSuaDoi' => ['nullable', 'array'],
            'items.*.vanbanBiSuaDoi.*' => ['string'],
            'items.*.vanbanDuocHuongDan' => ['nullable', 'array'],
            'items.*.vanbanDuocHuongDan.*' => ['string'],
            'items.*.vanbanHuongDan' => ['nullable', 'array'],
            'items.*.vanbanHuongDan.*' => ['string'],
            'items.*.vanbanBiDinhChinh' => ['nullable', 'array'],
            'items.*.vanbanBiDinhChinh.*' => ['string'],
            'items.*.vanbanDinhChinh' => ['nullable', 'array'],
            'items.*.vanbanDinhChinh.*' => ['string'],
            'items.*.vanbanDuocHopNhat' => ['nullable', 'array'],
            'items.*.vanbanDuocHopNhat.*' => ['string'],
            'items.*.vanbanHopNhat' => ['nullable', 'array'],
            'items.*.vanbanHopNhat.*' => ['string'],
        ]);

        DB::transaction(function () use ($payload) {
            foreach ($payload['items'] as $item) {
                $vbpl = Vbpl::create([
                    'law_id' => $item['law_id'] ?? null,
                    'name' => $item['name'] ?? null,
                    'so_hieu' => $item['so_hieu'] ?? null,
                    'loai_van_ban' => $item['loai_van_ban'] ?? null,
                    'noi_ban_hanh' => $item['noi_ban_hanh'] ?? null,
                    'ngay_ban_hanh' => $this->parseDate($item['ngay_ban_hanh'] ?? null),
                    'ngay_hieu_luc' => $this->parseDate($item['ngay_co_hieu_luc'] ?? $item['ngay_hieu_luc'] ?? null),
                    'ngay_cap_nhat' => $this->parseDate($item['ngay_cap_nhat'] ?? null),
                    'tinh_trang_hieu_luc' => $item['tinh_trang_hieu_luc'] ?? null,
                    'source_url' => $item['source_url'] ?? null,
                ]);

                if (!empty($item['content']) && !empty($item['law_id'])) {
                    $dir = base_path('data');
                    if (!is_dir($dir)) {
                        mkdir($dir, 0755, true);
                    }
                    file_put_contents($dir . DIRECTORY_SEPARATOR . $item['law_id'] . '.txt', $item['content']);
                }

                $vbpl->luocDo()->create([
                    'luoc_do_html' => $item['luoc_do_html'] ?? null,
                    'luoc_do_links' => $item['luoc_do_links'] ?? [],
                    'vanban_bi_bai_bo' => $item['vanbanBiBaiBo'] ?? [],
                    'vanban_bai_bo' => $item['vanbanBaiBo'] ?? [],
                    'vanban_sua_doi' => $item['vanbanSuaDoi'] ?? [],
                    'vanban_bi_sua_doi' => $item['vanbanBiSuaDoi'] ?? [],
                    'vanban_duoc_huong_dan' => $item['vanbanDuocHuongDan'] ?? [],
                    'vanban_huong_dan' => $item['vanbanHuongDan'] ?? [],
                    'vanban_bi_dinh_chinh' => $item['vanbanBiDinhChinh'] ?? [],
                    'vanban_dinh_chinh' => $item['vanbanDinhChinh'] ?? [],
                    'vanban_duoc_hop_nhat' => $item['vanbanDuocHopNhat'] ?? [],
                    'vanban_hop_nhat' => $item['vanbanHopNhat'] ?? [],
                ]);
            }
        });

        return response()->json([
            'success' => true,
            'items_saved' => count($payload['items']),
        ], 201);
    }
}
