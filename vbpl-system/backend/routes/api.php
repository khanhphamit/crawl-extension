<?php

use App\Http\Controllers\Api\CrawlController;
use Illuminate\Support\Facades\Route;

Route::middleware('api')->group(function () {
    Route::post('/crawl', [CrawlController::class, 'store']);
});
