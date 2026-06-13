import { test } from "node:test";
import assert from "node:assert/strict";
import { AntiDetectionThrottle, isCaptchaByText } from "../src/utils/anti-detection.ts";

// rng cố định để cooldown xác định (jitter = 0)
const noJitter = () => 0;

test("throttle: trạng thái khởi tạo bình thường", () => {
  const t = new AntiDetectionThrottle();
  assert.equal(t.consecutiveCaptchas, 0);
  assert.equal(t.slowdownFactor, 1);
  assert.equal(t.shouldRotateSession(), false);
});

test("throttle: cooldown tăng theo cấp số nhân khi bị chặn liên tiếp", () => {
  const t = new AntiDetectionThrottle();
  const base = 90000;

  t.registerCaptcha(); // lần 1 → factor 2^0 = 1
  assert.equal(t.cooldownMs(base, noJitter), base);

  t.registerCaptcha(); // lần 2 → factor 2^1 = 2
  assert.equal(t.cooldownMs(base, noJitter), base * 2);

  t.registerCaptcha(); // lần 3 → factor 2^2 = 4
  assert.equal(t.cooldownMs(base, noJitter), base * 4);
  assert.equal(t.shouldRotateSession(), true); // đạt ngưỡng đổi phiên
});

test("throttle: cooldown factor bị chặn trần ở 16", () => {
  const t = new AntiDetectionThrottle();
  for (let i = 0; i < 10; i++) t.registerCaptcha();
  // 2^9 = 512 nhưng phải kẹp ở 16
  assert.equal(t.cooldownMs(1000, noJitter), 1000 * 16);
});

test("throttle: slowdownFactor tăng khi chặn, kẹp trần ở 6", () => {
  const t = new AntiDetectionThrottle();
  for (let i = 0; i < 10; i++) t.registerCaptcha();
  assert.equal(t.slowdownFactor, 6);
});

test("throttle: jitter cộng thêm tối đa 50% base", () => {
  const t = new AntiDetectionThrottle();
  t.registerCaptcha(); // factor 1
  // rng = 0.999... → jitter ~ floor(0.999*base*0.5)
  const v = t.cooldownMs(1000, () => 0.9999);
  assert.equal(v, 1000 + Math.floor(0.9999 * 1000 * 0.5));
  assert.ok(v >= 1000 && v < 1500);
});

test("throttle: thành công reset đếm chặn và hồi phục tốc độ dần", () => {
  const t = new AntiDetectionThrottle();
  t.registerCaptcha(); // slowdown 2, consecutive 1
  t.registerCaptcha(); // slowdown 3, consecutive 2
  assert.equal(t.slowdownFactor, 3);

  t.registerSuccess();
  assert.equal(t.consecutiveCaptchas, 0); // đếm về 0 ngay
  assert.equal(t.slowdownFactor, 2.75); // hồi phục từ từ -0.25
  assert.equal(t.shouldRotateSession(), false);
});

test("throttle: slowdown không xuống dưới 1", () => {
  const t = new AntiDetectionThrottle();
  for (let i = 0; i < 20; i++) t.registerSuccess();
  assert.equal(t.slowdownFactor, 1);
});

test("throttle: resetAfterRotation đưa đếm chặn về 0", () => {
  const t = new AntiDetectionThrottle();
  t.registerCaptcha();
  t.registerCaptcha();
  t.registerCaptcha();
  assert.equal(t.shouldRotateSession(), true);
  t.resetAfterRotation();
  assert.equal(t.consecutiveCaptchas, 0);
  assert.equal(t.shouldRotateSession(), false);
});

test("isCaptchaByText: bắt trang chặn Cloudflare theo tiêu đề", () => {
  assert.equal(isCaptchaByText("Just a moment...", ""), true);
  assert.equal(isCaptchaByText("Attention Required! | Cloudflare", ""), true);
});

test("isCaptchaByText: bắt tiêu đề Cloudflare BẢN ĐỊA HOÁ (tiếng Việt)", () => {
  // Chrome tiếng Việt hiển thị "Chờ một chút..." thay vì "Just a moment..."
  assert.equal(isCaptchaByText("Chờ một chút...", ""), true);
  assert.equal(isCaptchaByText("Đang kiểm tra trình duyệt của bạn", ""), true);
});

test("isCaptchaByText: bắt trang ngắn chứa từ khoá xác minh", () => {
  assert.equal(isCaptchaByText("", "Vui lòng nhập captcha để tiếp tục"), true);
  assert.equal(isCaptchaByText("", "Mã xác minh không đúng"), true);
  assert.equal(isCaptchaByText("", "Our systems have detected unusual traffic"), true);
  assert.equal(isCaptchaByText("", "Xác nhận bạn không phải người máy"), true);
});

test("isCaptchaByText: KHÔNG báo nhầm văn bản pháp luật dài chứa 'xác thực'", () => {
  // Văn bản pháp luật hợp lệ, dài > 1500 ký tự, có chữ "xác thực" trong nội dung
  const longLegalDoc =
    "Điều 1. Quy định về xác thực điện tử và định danh. ".repeat(60) +
    "Nghị định này quy định chi tiết việc xác thực thông tin...";
  assert.ok(longLegalDoc.length > 1500);
  assert.equal(isCaptchaByText("Thư viện pháp luật", longLegalDoc), false);
});

test("isCaptchaByText: trang dài chứa từ 'captcha' lẻ tẻ vẫn không bị coi là chặn", () => {
  const longDoc = "Nội dung văn bản bình thường. ".repeat(80) + " từ captcha xuất hiện trong nội dung";
  assert.ok(longDoc.length > 1500);
  assert.equal(isCaptchaByText("", longDoc), false);
});

test("isCaptchaByText: trang trống không phải captcha", () => {
  assert.equal(isCaptchaByText("", ""), false);
});
