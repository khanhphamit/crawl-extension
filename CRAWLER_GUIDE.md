# 🔗 TVPL Crawler Extension - Complete Guide

## Overview

The TVPL Crawler is a Chrome extension that automatically extracts legal documents from **thuvienphapluat.vn** and saves them to your Laravel API. It features:

- **Two-phase crawling**: First collects links from list pages, then extracts detailed information
- **Batch API saves**: Sends multiple records per API call for efficiency
- **Progress tracking**: Real-time UI updates showing crawl progress and statistics
- **Configurable selectors**: Adapt to website structure changes without code modifications
- **Smart page loading**: Detects when pages are fully loaded before extraction
- **Session state**: Tracks progress with timestamps and logging
- **Chống phát hiện bot / Google captcha**: xem [docs/ANTI_DETECTION.md](docs/ANTI_DETECTION.md) (Cloudflare, throttle hạ nhiệt, 2 bẫy detect captcha, cách verify runtime)

---

## Installation & Setup

### 1. Install Extension

```bash
# Navigate to the extension directory
cd crawler-extension

# Install dependencies
npm install

# Build the extension
npm run build
```

### 2. Load in Chrome

1. Open **chrome://extensions/**
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Extension should appear in your toolbar

### 3. Grant Folder Access

1. Click the extension icon
2. Click **📁 Chọn thư mục** (Select folder)
3. Choose where to save extracted data
4. Folder access is required only for the optional file-saving feature

---

## Configuration

### Popup UI

The popup provides:
- **Status display**: Current crawl stage and any errors
- **Progress bar**: Visual indicator of completion percentage
- **Statistics**: Current page, total links, saved records
- **Controls**:
  - ▶️ **Bắt đầu**: Start crawling
  - ⏹️ **Dừng**: Stop immediately
  - ⏸️ **Tạm dừng**: Pause (for future resume)
  - ▶️ **Tiếp tục**: Resume from pause
  - 📁 **Thay thư mục**: Change output folder
  - ⚙️ **Cài đặt**: Open settings

### Settings Page (⚙️)

Configure selectors and API endpoint:

#### 🌐 URL Configuration
- **Base URL**: The search/list page URL (e.g., `https://thuvienphapluat.vn/page/tim-van-ban.aspx?page=1`)
  - The extension will automatically replace `?page=X` or `&page=X` with the current page number
- **API Endpoint**: Where to POST the extracted data (e.g., `https://yourapi.com/api/crawler/save`)

#### 📄 Pagination
- **Min Page**: Starting page (usually 1)
- **Max Page**: Ending page (determines how many pages to crawl)

#### 📋 Selectors - List Page
These are CSS selectors to find elements on the search/list page:

- **Item Container**: Wraps each result item (e.g., `.law-item`)
- **Link Selector**: The `<a>` tag linking to detail page (e.g., `a.law-link`)
- **Name Selector**: Contains the law name (e.g., `.law-name`)
- **Law ID Selector**: Element with law ID (e.g., `.law-id`)
- **Law ID Attribute**: HTML attribute holding ID (e.g., `data-id` or `id`)

#### 📖 Selectors - Detail Page
These are CSS selectors on the detail/full document page:

- **Số Hiệu**: Law number (e.g., `#sohieu`)
- **Loại Văn Bản**: Document type (e.g., `.loai-van-ban`)
- **Nơi Ban Hành**: Issuing agency (e.g., `.noi-ban-hanh`)
- **Ngày Ban Hành**: Issue date (e.g., `.ngay-ban-hanh`)
- **Ngày Có Hiệu Lực**: Effective date (e.g., `.ngay-hieu-luc`)
- **Ngày Cập Nhật**: Last update date (e.g., `.ngay-cap-nhat`)
- **Tình Trạng Hiệu Lực**: Legal status (e.g., `.tinh-trang`)
- **Content Selector**: Main document content (e.g., `#content` or `.document-body`)

#### ⚡ Performance
- **Batch Size**: Number of records per API call (e.g., 10-20)
- **Delay Multiplier**: Multiplier for random delays between requests (1 = 1-3s, 2 = 2-6s)

---

## How to Find CSS Selectors

### Using Browser DevTools

1. **Open DevTools**: Press `F12` or `Ctrl+Shift+I`
2. **Open Inspector**: Press `Ctrl+Shift+C` or click the icon
3. **Click the element** you want to select on the page
4. **In DevTools**, right-click the highlighted code
5. **Select "Copy"** → **"Copy selector"**
6. **Paste** into the settings field

### Example for thuvienphapluat.vn

List page (tim-van-ban.aspx):
- Item Container: `.law-item` or `.search-result-item`
- Link Selector: `a.law-link` or `.item-title > a`
- Law ID Attribute: `data-id` or `id`

Detail page:
- Content: `.document-content` or `#main-content`
- Số Hiệu: `.so-hieu` or `[data-field="so-hieu"]`

---

## Laravel API Setup

### Create Database Table

```sql
CREATE TABLE `crawl_laws` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `law_id` varchar(255) UNIQUE,
  `name` text,
  `so_hieu` varchar(255),
  `loai_van_ban` varchar(255),
  `ngay_ban_hanh` date,
  `ngay_co_hieu_luc` date,
  `ngay_cap_nhat` date,
  `noi_ban_hanh` varchar(255),
  `tinh_trang_hieu_luc` varchar(255),
  `content` longtext,
  `source_url` text,
  `created_at` timestamp,
  `updated_at` timestamp
);
```

### Create Migration

```bash
php artisan make:migration create_crawl_laws_table
```

### Create Controller

Use the provided `laravel-api/CrawlerController.php`:

```bash
cp laravel-api/CrawlerController.php app/Http/Controllers/
```

### Register Route

In `routes/api.php`:

```php
Route::post('/crawler/save', 'CrawlerController@save');
Route::get('/crawler/stats', 'CrawlerController@getStats');
Route::get('/crawler/check-exists', 'CrawlerController@checkExists');
```

### API Contract

**POST** `/api/crawler/save`

**Request Body:**
```json
{
  "items": [
    {
      "law_id": "706265",
      "name": "Công điện 41/CĐ-TTg...",
      "so_hieu": "41/CĐ-TTg",
      "loai_van_ban": "Công điện",
      "ngay_ban_hanh": "2026-05-21",
      "ngay_co_hieu_luc": "2026-05-21",
      "ngay_cap_nhat": "2026-05-21",
      "noi_ban_hanh": "Thủ tướng Chính phủ",
      "tinh_trang_hieu_luc": "Còn hiệu lực",
      "content": "<div>...</div>",
      "source_url": "https://thuvienphapluat.vn/..."
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Saved 10 records",
  "count": 10
}
```

---

## How It Works

### Phase 1: Collect Links (📋)

1. Opens each page URL (1 to max_page)
2. Waits for page to fully load
3. Extracts links using list page selectors
4. Accumulates all links in memory
5. Applies random delay between requests

### Phase 2: Extract & Save (📄)

1. Opens each link from Phase 1
2. Waits for page load
3. Extracts all detail fields using detail selectors
4. Accumulates records in a batch
5. When batch size is reached, **POST to API**
6. Continues until all links processed
7. Sends remaining records in final batch

### Error Handling

- **Captcha detected**: Logs warning, skips that page
- **Network timeout**: Logs error, continues with next
- **Invalid selector**: Returns empty string, continues
- **API failure**: Pauses and displays error in UI

---

## Page Load Detection Strategy

The extension uses three methods to detect when a page is ready:

1. **Document Ready State**: Checks `document.readyState === "complete"`
2. **Scroll Height Stability**: Waits for 2 seconds of no changes (detects lazy loading)
3. **Timeout Fallback**: Maximum 30 seconds (configurable)

This ensures content loaded via JavaScript is captured correctly.

---

## Console Logging

Open DevTools (F12) and go to **Console** tab to see detailed logs:

```
[14:30:45] 🚀 Bắt đầu crawl
[14:30:46] 📋 Phase 1: Tập hợp danh sách links
[14:30:47] 📋 Gửi yêu cầu COLLECT tới tab 123
[14:30:48] ✅ Nhận được 20 links
[14:30:49] 📤 Gửi batch 10 records tới API
[14:30:50] ✅ Lưu thành công 10 records
...
[14:45:30] 🎉 Crawl thành công!
```

---

## Troubleshooting

### Extension doesn't load
- Check browser console for errors (F12)
- Verify manifest.json is valid
- Try rebuilding: `npm run build`

### Selectors not working
- Open target page in browser
- Use DevTools to verify selector exists
- Test with: `document.querySelector('selector').length`
- Check for dynamic class names that change

### API returns errors
- Verify API endpoint URL is correct
- Check server logs for request data
- Ensure Laravel validation rules match request format
- Test endpoint with cURL or Postman

### Pages not loading fully
- Increase `pageLoadTimeout` in config (default 30000ms)
- Check if site uses CAPTCHA or has rate limiting
- Add delay multiplier to slow down requests

### Out of Memory
- Reduce batch size to save memory
- Reduce max page count
- Restart extension between crawls

---

## Performance Tips

1. **Batch Size**: Use 10-20 for optimal API performance
2. **Delay Multiplier**: Start with 1.5-2 to avoid rate limiting
3. **Max Pages**: Test with small range first (1-10 pages)
4. **Time of Day**: Crawl during off-peak hours for faster responses
5. **Network**: Use wired connection if possible for stability

---

## Security Notes

- **API Authentication**: Add `Authorization` header to API calls if needed (modify `api-helper.ts`)
- **CORS**: Ensure your API allows POST from chrome-extension://... origins
- **Rate Limiting**: Server should implement rate limiting to prevent abuse
- **Content Validation**: Validate all extracted data on the server side

---

## File Structure

```
crawler-extension/
├── src/
│   ├── background/
│   │   └── index.ts           # Main crawl logic, two-phase orchestration
│   ├── content/
│   │   └── scraper.ts         # DOM extraction, page load detection
│   ├── popup/
│   │   ├── App.tsx            # UI controls, progress display
│   │   └── main.tsx
│   ├── options/
│   │   ├── App.tsx            # Settings page with selector inputs
│   │   └── main.tsx
│   ├── utils/
│   │   ├── api-helper.ts      # API calls, data formatting
│   │   ├── dom-helper.ts      # DOM extraction utilities
│   │   └── sleep.ts           # Delay helpers
│   ├── config/
│   │   └── default-config.ts  # All selectors, API, pagination config
│   ├── types/
│   │   └── global.d.ts        # Type definitions
│   ├── index.css
│   └── main.tsx
├── laravel-api/
│   └── CrawlerController.php   # Laravel controller example
├── dist/                       # Built extension (load this in Chrome)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── manifest.json
```

---

## Advanced: Custom Configuration

To modify defaults, edit `src/config/default-config.ts`:

```typescript
export const CrawlConfig = {
  url: {
    baseUrl: "YOUR_URL",
    apiEndpoint: "YOUR_API",
  },
  pagination: {
    minPage: 1,
    maxPage: 100,
  },
  listPageSelectors: {
    // Your list page CSS selectors
  },
  detailPageSelectors: {
    // Your detail page CSS selectors
  },
  batch: {
    batchSize: 10,
    apiTimeout: 30000,
  },
  delay: {
    pageLoadTimeout: 30000,
    delayMultiplier: 1.5,
    minDelay: 1000,
    maxDelay: 3000,
  },
  logging: {
    verbose: true,
    excludeFieldsFromLog: ["content"],
  },
};
```

Then rebuild: `npm run build`

---

## Support & Issues

- **Check console logs** (F12 → Console tab)
- **Verify API endpoint** is accessible and returns proper JSON
- **Test selectors** individually in DevTools
- **Report bugs** with console logs and screenshots

---

## License

This extension is provided as-is for educational purposes.

