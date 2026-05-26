<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use DB;
use Carbon\Carbon;

class CrawlerController extends Controller
{
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
     *       "ngay_ban_hanh": "2026-05-21",
     *       "ngay_co_hieu_luc": "2026-05-21",
     *       "ngay_cap_nhat": "2026-05-21",
     *       "noi_ban_hanh": "Thủ tướng Chính phủ",
     *       "tinh_trang_hieu_luc": "Còn hiệu lực",
     *       "content": "<div>...</div>",
     *       "source_url": "https://thuvienphapluat.vn/..."
     *     },
     *     ...
     *   ]
     * }
     */
    public function save(Request $request)
    {
        try {
            // Validate request
            $validated = $request->validate([
                'items' => 'required|array|min:1',
                'items.*.law_id' => 'required|string',
                'items.*.name' => 'required|string',
                'items.*.so_hieu' => 'nullable|string',
                'items.*.loai_van_ban' => 'nullable|string',
                'items.*.ngay_ban_hanh' => 'nullable|date',
                'items.*.ngay_co_hieu_luc' => 'nullable|date',
                'items.*.ngay_cap_nhat' => 'nullable|date',
                'items.*.noi_ban_hanh' => 'nullable|string',
                'items.*.tinh_trang_hieu_luc' => 'nullable|string',
                'items.*.content' => 'nullable|string',
                'items.*.source_url' => 'required|url',
            ]);

            $items = $validated['items'];
            $insertData = [];
            $now = date('Y-m-d H:i:s');

            // Prepare insert data
            foreach ($items as $item) {
                $insertData[] = [
                    'law_id' => $item['law_id'],
                    'name' => $item['name'],
                    'so_hieu' => $item['so_hieu'] ?? null,
                    'loai_van_ban' => $item['loai_van_ban'] ?? null,
                    'ngay_ban_hanh' => $item['ngay_ban_hanh'] ?? null,
                    'ngay_co_hieu_luc' => $item['ngay_co_hieu_luc'] ?? null,
                    'ngay_cap_nhat' => $item['ngay_cap_nhat'] ?? null,
                    'noi_ban_hanh' => $item['noi_ban_hanh'] ?? null,
                    'tinh_trang_hieu_luc' => $item['tinh_trang_hieu_luc'] ?? null,
                    'content' => $item['content'] ?? null,
                    'source_url' => $item['source_url'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // Insert to database
            DB::table('crawl_laws')->insert($insertData);

            \Log::info('Crawler saved ' . count($items) . ' records', [
                'count' => count($items),
                'timestamp' => $now,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Saved ' . count($items) . ' records',
                'count' => count($items),
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Crawler validation error', [
                'errors' => $e->errors(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $e->errors(),
            ], 422);

        } catch (\Exception $e) {
            \Log::error('Crawler save error', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get crawl statistics
     */
    public function getStats()
    {
        try {
            $stats = [
                'total_records' => DB::table('crawl_laws')->count(),
                'today_count' => DB::table('crawl_laws')
                    ->whereDate('created_at', today())
                    ->count(),
                'this_week_count' => DB::table('crawl_laws')
                    ->whereBetween('created_at', [
                        now()->startOfWeek(),
                        now()->endOfWeek(),
                    ])
                    ->count(),
                'last_crawl' => DB::table('crawl_laws')
                    ->orderBy('created_at', 'desc')
                    ->select('created_at')
                    ->first(),
            ];

            return response()->json([
                'success' => true,
                'data' => $stats,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check if law_id already exists
     */
    public function checkExists(Request $request)
    {
        try {
            $lawId = $request->query('law_id');

            if (!$lawId) {
                return response()->json([
                    'success' => false,
                    'message' => 'law_id is required',
                ], 400);
            }

            $exists = DB::table('crawl_laws')
                ->where('law_id', $lawId)
                ->exists();

            return response()->json([
                'success' => true,
                'exists' => $exists,
                'law_id' => $lawId,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
