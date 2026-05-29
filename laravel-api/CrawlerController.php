<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vbpl;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CrawlerController extends Controller
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

    /**
     * Save crawled law documents to database
     *
     * Expected JSON payload:
     * {
     *   "items": [
     *     {
     *       "law_id": "706265",
     *       "name": "Công điện 41/CĐ-TTg...",
     *       "so_hieu": "41/CĐ-TTg",
     *       "loai_van_ban": "Công điện",
     *       "ngay_ban_hanh": "21/05/2026",
     *       "ngay_co_hieu_luc": "21/05/2026",
     *       "ngay_cap_nhat": "21/05/2026",
     *       "noi_ban_hanh": "Thủ tướng Chính phủ",
     *       "tinh_trang_hieu_luc": "Còn hiệu lực",
     *       "source_url": "https://...",
     *       "content": "<div>...</div>",
     *       "luoc_do_html": "<div>...</div>",
     *       "luoc_do_links": ["https://..."],
     *       "vanbanBiBaiBo": [], "vanbanBaiBo": [],
     *       "vanbanSuaDoi": [], "vanbanBiSuaDoi": [],
     *       "vanbanDuocHuongDan": [], "vanbanHuongDan": [],
     *       "vanbanBiDinhChinh": [], "vanbanDinhChinh": [],
     *       "vanbanDuocHopNhat": [], "vanbanHopNhat": []
     *     }
     *   ]
     * }
     */
    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'items'                          => ['required', 'array'],
            'items.*.law_id'                 => ['nullable', 'string'],
            'items.*.name'                   => ['nullable', 'string'],
            'items.*.so_hieu'                => ['nullable', 'string'],
            'items.*.loai_van_ban'           => ['nullable', 'string'],
            'items.*.noi_ban_hanh'           => ['nullable', 'string'],
            'items.*.ngay_ban_hanh'          => ['nullable', 'string'],
            'items.*.ngay_co_hieu_luc'       => ['nullable', 'string'],
            'items.*.ngay_hieu_luc'          => ['nullable', 'string'],
            'items.*.ngay_cap_nhat'          => ['nullable', 'string'],
            'items.*.tinh_trang_hieu_luc'    => ['nullable', 'string'],
            'items.*.source_url'             => ['nullable', 'string'],
            'items.*.content'                => ['nullable', 'string'],
            'items.*.luoc_do_html'           => ['nullable', 'string'],
            'items.*.luoc_do_links'          => ['nullable', 'array'],
            'items.*.luoc_do_links.*'        => ['string'],
            'items.*.vanbanBiBaiBo'          => ['nullable', 'array'],
            'items.*.vanbanBiBaiBo.*'        => ['string'],
            'items.*.vanbanBaiBo'            => ['nullable', 'array'],
            'items.*.vanbanBaiBo.*'          => ['string'],
            'items.*.vanbanSuaDoi'           => ['nullable', 'array'],
            'items.*.vanbanSuaDoi.*'         => ['string'],
            'items.*.vanbanBiSuaDoi'         => ['nullable', 'array'],
            'items.*.vanbanBiSuaDoi.*'       => ['string'],
            'items.*.vanbanDuocHuongDan'     => ['nullable', 'array'],
            'items.*.vanbanDuocHuongDan.*'   => ['string'],
            'items.*.vanbanHuongDan'         => ['nullable', 'array'],
            'items.*.vanbanHuongDan.*'       => ['string'],
            'items.*.vanbanBiDinhChinh'      => ['nullable', 'array'],
            'items.*.vanbanBiDinhChinh.*'    => ['string'],
            'items.*.vanbanDinhChinh'        => ['nullable', 'array'],
            'items.*.vanbanDinhChinh.*'      => ['string'],
            'items.*.vanbanDuocHopNhat'      => ['nullable', 'array'],
            'items.*.vanbanDuocHopNhat.*'    => ['string'],
            'items.*.vanbanHopNhat'          => ['nullable', 'array'],
            'items.*.vanbanHopNhat.*'        => ['string'],
        ]);

        DB::transaction(function () use ($payload) {
            foreach ($payload['items'] as $item) {
                $vbpl = Vbpl::updateOrCreate(
                    ['law_id' => $item['law_id'] ?? null],
                    [
                        'name'                 => $item['name'] ?? null,
                        'so_hieu'              => $item['so_hieu'] ?? null,
                        'loai_van_ban'         => $item['loai_van_ban'] ?? null,
                        'noi_ban_hanh'         => $item['noi_ban_hanh'] ?? null,
                        'ngay_ban_hanh'        => $this->parseDate($item['ngay_ban_hanh'] ?? null),
                        'ngay_hieu_luc'        => $this->parseDate($item['ngay_co_hieu_luc'] ?? $item['ngay_hieu_luc'] ?? null),
                        'ngay_cap_nhat'        => $this->parseDate($item['ngay_cap_nhat'] ?? null),
                        'tinh_trang_hieu_luc'  => $item['tinh_trang_hieu_luc'] ?? null,
                        'source_url'           => $item['source_url'] ?? null,
                    ]
                );

                if (!empty($item['content'])) {
                    $vbpl->contents()->updateOrCreate(
                        ['law_id' => $vbpl->law_id],
                        ['content' => $item['content']]
                    );
                }

                $vbpl->luocDo()->updateOrCreate(
                    ['law_id' => $vbpl->law_id],
                    [
                        'luoc_do_html'          => $item['luoc_do_html'] ?? null,
                        'luoc_do_links'         => $item['luoc_do_links'] ?? [],
                        'vanban_bi_bai_bo'      => $item['vanbanBiBaiBo'] ?? [],
                        'vanban_bai_bo'         => $item['vanbanBaiBo'] ?? [],
                        'vanban_sua_doi'        => $item['vanbanSuaDoi'] ?? [],
                        'vanban_bi_sua_doi'     => $item['vanbanBiSuaDoi'] ?? [],
                        'vanban_duoc_huong_dan' => $item['vanbanDuocHuongDan'] ?? [],
                        'vanban_huong_dan'      => $item['vanbanHuongDan'] ?? [],
                        'vanban_bi_dinh_chinh'  => $item['vanbanBiDinhChinh'] ?? [],
                        'vanban_dinh_chinh'     => $item['vanbanDinhChinh'] ?? [],
                        'vanban_duoc_hop_nhat'  => $item['vanbanDuocHopNhat'] ?? [],
                        'vanban_hop_nhat'       => $item['vanbanHopNhat'] ?? [],
                    ]
                );
            }
        });

        return response()->json([
            'success'     => true,
            'items_saved' => count($payload['items']),
        ], 201);
    }

    /**
     * Get crawl statistics
     */
    public function getStats(): JsonResponse
    {
        $stats = [
            'total_records'    => Vbpl::count(),
            'today_count'      => Vbpl::whereDate('created_at', today())->count(),
            'this_week_count'  => Vbpl::whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
            'last_crawl'       => Vbpl::latest()->value('created_at'),
        ];

        return response()->json([
            'success' => true,
            'data'    => $stats,
        ]);
    }

    /**
     * Check if law_id already exists
     */
    public function checkExists(Request $request): JsonResponse
    {
        $lawId = $request->query('law_id');

        if (!$lawId) {
            return response()->json([
                'success' => false,
                'message' => 'law_id is required',
            ], 400);
        }

        $exists = Vbpl::where('law_id', $lawId)->exists();

        return response()->json([
            'success' => true,
            'exists'  => $exists,
            'law_id'  => $lawId,
        ]);
    }
}
