# Chống phát hiện bot & Google captcha

Tài liệu này ghi lại kiến thức về cơ chế chống phát hiện của crawler, hai bẫy phát hiện captcha đã sửa, và cách kiểm chứng runtime. Đối tượng crawl là **thuvienphapluat.vn**.

## 1. Bối cảnh: site nằm sau Cloudflare

thuvienphapluat.vn được bảo vệ bởi **Cloudflare**. Mọi trình duyệt tự động bị Cloudflare chặn **trước cả** khi Google reCAPTCHA kịp hiển thị:

- `curl` / request không phải trình duyệt → **HTTP 403**.
- Chromium **headless** → 403 với trang challenge "Just a moment...".
- Chrome **headed nhưng do Playwright `launch`/`launchPersistentContext`** điều khiển → vẫn 403 (vì có cờ `--enable-automation`, `navigator.webdriver=true`).
- Chrome do **con người** mở, hoặc **`spawn` chrome.exe bình thường rồi attach CDP** → **VƯỢT** được Cloudflare.

> ⇒ Cổng chặn thực tế là **Cloudflare**, không phải Google reCAPTCHA. Extension chỉ hoạt động vì chạy trong Chrome thật của người dùng.

## 2. Nguyên tắc cốt lõi: HẠ NHIỆT thay vì bỏ qua

Khi site thử thách (captcha/Cloudflare), crawler **phải giảm nhịp / nghỉ / đổi phiên**, KHÔNG được tiếp tục nã request.

> ⚠️ Bug bản cũ: khi gặp captcha lúc thu thập link, code chỉ `return []` rồi sang trang sau → tiếp tục nã request trong khi đang bị gắn cờ → bị chặn nặng hơn. Đây là sửa quan trọng nhất.

Logic thuần nằm ở [`src/utils/anti-detection.ts`](../src/utils/anti-detection.ts), có unit test ở [`tests/anti-detection.test.ts`](../tests/anti-detection.test.ts), dùng bởi [`src/background/index.ts`](../src/background/index.ts) và [`src/content/scraper.ts`](../src/content/scraper.ts).

### `AntiDetectionThrottle`
| Hàm | Tác dụng |
|---|---|
| `registerCaptcha()` | tăng `consecutiveCaptchas`; tăng `slowdownFactor` (+1, trần 6) — nhân vào MỌI delay |
| `registerSuccess()` | reset đếm chặn về 0; giảm `slowdownFactor` −0.25 (hồi phục dần, không nhảy về 1) |
| `cooldownMs(base)` | nghỉ lũy thừa 1×→2×→4×→8×→16× + jitter |
| `shouldRotateSession()` | true sau 3 lần liên tiếp → `handleCaptchaCooldown` đóng tab + warm-up lại (đổi "phiên") |

## 3. Hai bẫy phát hiện captcha (đã sửa — runtime mới thấy)

### Bẫy 1 — Tiêu đề Cloudflare BẢN ĐỊA HOÁ
Cloudflare dịch tiêu đề challenge theo locale. Chrome tiếng Việt hiển thị **"Chờ một chút..."** chứ KHÔNG phải "Just a moment...". Bản đầu chỉ bắt tiếng Anh → bỏ sót → extension tưởng trang ổn, lấy 0 link.
➡️ `isCaptchaByText` nay bắt cả các marker bản địa hoá ("chờ một chút", "đang kiểm tra"...).

### Bẫy 2 — reCAPTCHA NHÚNG SẴN (false-positive)
thuvienphapluat.vn nhúng reCAPTCHA vô hình (sitekey `6LdFASgp...`, cho login) trên **mọi trang**. Ở trạng thái nghỉ: anchor checkbox `0x0/ẩn`, `.g-recaptcha` và `[data-sitekey]` đều `0x0/ẩn`.
➡️ KHÔNG được coi **sự hiện diện** widget là captcha — nếu không sẽ báo nhầm mọi trang tốt → cooldown vô tận, không crawl được gì.
➡️ `isCaptcha()` (scraper) chỉ tính khi challenge **THỰC SỰ hiển thị** (`hasVisibleChallengeWidget`: anchor/Turnstile/hCaptcha `offsetParent != null && >50×50`).

### Tránh báo nhầm văn bản pháp luật
Văn bản pháp luật dài thường chứa chữ "xác thực" hợp lệ → chỉ tính captcha theo từ khoá khi **trang ngắn (<1500 ký tự)**.

## 4. Tham số an toàn ([`src/config/default-config.ts`](../src/config/default-config.ts))
- `batchSize = 5` — gửi API sớm, mất ít dữ liệu nếu bị chặn giữa chừng.
- `delayMultiplier = 1.5` — giãn nhịp ~50%.
- `captchaWaitTime = 90000` — cơ sở cho cooldown (sẽ nhân lũy thừa khi lặp lại).

## 5. Kiểm chứng

### Unit test
```bash
npm test    # node --test --experimental-strip-types "tests/**/*.test.ts"
```
Node 22.12 chạy TS trực tiếp qua `--experimental-strip-types`. Import TS phải ghi rõ đuôi `.ts`.

### Crawl thật qua Cloudflare
```bash
npm install playwright --no-save     # cài 1 lần
npx playwright install chromium       # cài 1 lần
node --experimental-strip-types scripts/verify-cdp-attach.ts
```
**Kỹ thuật then chốt:** `spawn` `chrome.exe` như tiến trình BÌNH THƯỜNG với `--remote-debugging-port`, rồi `chromium.connectOverCDP(...)`. KHÔNG dùng `chromium.launch` của Playwright (thêm cờ automation → bị Cloudflare chặn).

> Kết quả đã đạt: vượt Cloudflare, lấy 20 link trang danh sách + đọc trang chi tiết, **KHÔNG gặp Google captcha**.

Script phụ `scripts/verify-no-captcha.ts` (headless) chỉ minh hoạ cooldown leo thang — luôn bị Cloudflare 403, không vào được nội dung.

## 6. Giới hạn
Cải thiện code chỉ **giảm leo thang** và **phát hiện đúng** — không vượt được Cloudflare nếu IP/fingerprint đã bị gắn cờ. Yếu tố còn lại nằm ngoài code: nhịp độ tổng thể (crawl ít trang/phiên) và xoay IP.
