// Logic chống phát hiện bot tách riêng để kiểm thử được (không phụ thuộc DOM/chrome).

// Trạng thái throttle thích ứng: khi site thử thách (captcha/Cloudflare) ta phải
// HẠ NHIỆT (nghỉ lâu hơn, chạy chậm hơn, đổi phiên) thay vì tiếp tục nã request.
export class AntiDetectionThrottle {
  consecutiveCaptchas = 0;
  slowdownFactor = 1; // nhân vào mọi delay; tăng khi bị chặn, hồi phục dần khi thành công

  // Số lần liên tiếp bị chặn trước khi nên đổi phiên (đóng tab + warm-up lại)
  static readonly ROTATE_THRESHOLD = 3;
  static readonly MAX_SLOWDOWN = 6;
  static readonly MAX_COOLDOWN_FACTOR = 16;

  registerSuccess(): void {
    this.consecutiveCaptchas = 0;
    if (this.slowdownFactor > 1) {
      // Hồi phục từ từ, không nhảy về 1 ngay để tránh tăng tốc đột ngột
      this.slowdownFactor = Math.max(1, this.slowdownFactor - 0.25);
    }
  }

  registerCaptcha(): void {
    this.consecutiveCaptchas++;
    this.slowdownFactor = Math.min(this.slowdownFactor + 1, AntiDetectionThrottle.MAX_SLOWDOWN);
  }

  // Cooldown tăng theo cấp số nhân theo số lần bị chặn liên tiếp + jitter
  cooldownMs(base: number, rng: () => number = Math.random): number {
    const factor = Math.min(
      2 ** Math.max(0, this.consecutiveCaptchas - 1),
      AntiDetectionThrottle.MAX_COOLDOWN_FACTOR
    );
    const jitter = Math.floor(rng() * base * 0.5);
    return base * factor + jitter;
  }

  shouldRotateSession(): boolean {
    return this.consecutiveCaptchas >= AntiDetectionThrottle.ROTATE_THRESHOLD;
  }

  resetAfterRotation(): void {
    this.consecutiveCaptchas = 0;
  }
}

// Phân loại captcha dựa trên tiêu đề + nội dung text (phần không cần querySelector).
// Tách riêng để test được và tránh báo nhầm với văn bản pháp luật chứa chữ "xác thực".
// Tiêu đề trang chặn Cloudflare — bản địa hoá theo locale trình duyệt.
// QUAN TRỌNG: Chrome tiếng Việt hiển thị "Chờ một chút..." chứ KHÔNG phải
// "Just a moment..." → phải bắt cả bản dịch nếu không sẽ bỏ sót challenge.
const CHALLENGE_TITLE_MARKERS = [
  "just a moment", // EN
  "attention required", // EN (Cloudflare block)
  "chờ một chút", // VI ("Chờ một chút...")
  "đang kiểm tra", // VI ("Đang kiểm tra trình duyệt của bạn")
  "checking your browser", // EN cũ
  "un momento", // ES
  "un instant", // FR
  "einen moment", // DE
];

export function isCaptchaByText(title: string, bodyText: string): boolean {
  const t = (title || "").toLowerCase();
  if (CHALLENGE_TITLE_MARKERS.some((m) => t.includes(m))) {
    return true;
  }

  const text = (bodyText || "").toLowerCase();
  // Yêu cầu trang ngắn để tránh false positive: trang chặn thường rất ngắn,
  // còn văn bản pháp luật hợp lệ thường dài và có thể chứa chữ "xác thực".
  const isShortPage = text.length < 1500;
  const hasKeyword =
    text.includes("captcha") ||
    text.includes("mã xác minh") ||
    text.includes("vui lòng xác nhận") ||
    text.includes("không phải người máy") ||
    text.includes("kiểm tra trình duyệt") ||
    text.includes("i'm not a robot") ||
    text.includes("verify you are human") ||
    text.includes("checking if the site connection is secure") ||
    text.includes("unusual traffic");
  return isShortPage && hasKeyword;
}
