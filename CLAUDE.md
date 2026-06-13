# CLAUDE.md

Chrome extension (MV3, React + Vite + TS) crawl văn bản pháp luật từ **thuvienphapluat.vn** và lưu về Laravel API.

## Cấu trúc chính
- `src/background/index.ts` — orchestration: vòng lặp trang, lấy chi tiết, batch API, throttle chống bot.
- `src/content/scraper.ts` — chạy trong trang: thu thập link, trích xuất chi tiết, mô phỏng hành vi người, `isCaptcha()`.
- `src/utils/anti-detection.ts` — logic chống phát hiện thuần (có test).
- `src/config/default-config.ts` — selector, pagination, delay, batch.
- `tests/` — unit test (chạy bằng `npm test`).
- `scripts/verify-*.ts` — kiểm chứng runtime.

## Lệnh
- `npm run build` — `tsc -b && vite build` → `dist/` (load unpacked vào Chrome).
- `npm test` — unit test (Node `--experimental-strip-types`).
- `npm run dev` — vite dev.

## ⚠️ Chống phát hiện bot / Google captcha — ĐỌC TRƯỚC KHI SỬA
Xem [docs/ANTI_DETECTION.md](docs/ANTI_DETECTION.md). Tóm tắt điều dễ sai:
1. Site sau **Cloudflare** — chặn mọi trình duyệt tự động (403) trước cả Google reCAPTCHA. Chỉ Chrome người-dùng hoặc `spawn chrome.exe + connectOverCDP` mới qua được; Playwright `launch` luôn bị chặn.
2. **Nguyên tắc:** gặp challenge thì HẠ NHIỆT (cooldown lũy thừa, slowdown, đổi phiên) — KHÔNG nã tiếp. Đi qua `AntiDetectionThrottle`.
3. **2 bẫy detect captcha:** (a) title Cloudflare bản địa hoá "Chờ một chút..." (không phải "Just a moment..."); (b) reCAPTCHA NHÚNG SẴN nghỉ trên mọi trang — chỉ tính captcha khi challenge HIỂN THỊ (>50×50), KHÔNG theo sự hiện diện widget, nếu không báo nhầm mọi trang tốt.
4. Verify thay đổi bằng `node --experimental-strip-types scripts/verify-cdp-attach.ts`.

## Quy ước
- Code & log/ghi chú bằng tiếng Việt (giữ nguyên phong cách hiện có).
