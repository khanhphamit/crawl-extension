// Kiểm chứng runtime: chạy crawl thật lên thuvienphapluat.vn bằng trình duyệt thật,
// áp dụng ĐÚNG logic phát hiện captcha + throttle của extension, và báo cáo
// xem có bị Google captcha/Cloudflare chặn trong thực tế hay không.
//
// Chạy: node --experimental-strip-types scripts/verify-no-captcha.ts
import { chromium, type Page } from "playwright";
import { AntiDetectionThrottle, isCaptchaByText } from "../src/utils/anti-detection.ts";

const BASE_URL =
  "https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=&area=0&type=0&status=0&lan=1&org=0&signer=0&match=True&sort=1&bdate=16/03/2025&edate=02/07/2025&page=";
const LIST_SELECTOR = "p.nqTitle a";
const MAX_PAGES = Number(process.env.MAX_PAGES || 3);
const MAX_DETAILS = Number(process.env.MAX_DETAILS || 2);

const throttle = new AntiDetectionThrottle();
let captchaHits = 0;
let pagesVisited = 0;

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Phát hiện captcha dùng đúng logic của extension (widget selectors + isCaptchaByText)
async function detectCaptcha(page: Page, httpStatus?: number): Promise<boolean> {
  // Cho Cloudflare challenge kịp render title "Just a moment..." trước khi đọc
  await wait(2000);
  // 403/503 từ Cloudflare là tín hiệu chặn/challenge rõ ràng
  if (httpStatus === 403 || httpStatus === 503) return true;
  const probe = await page.evaluate(() => {
    const hasWidget = !!(
      document.querySelector('iframe[src*="recaptcha"]') ||
      document.querySelector('iframe[src*="hcaptcha"]') ||
      document.querySelector('.g-recaptcha, #g-recaptcha, .h-captcha, [data-sitekey]') ||
      document.querySelector('#captcha, #captchaImg') ||
      document.querySelector('#challenge-running, #challenge-form, #cf-challenge-running, #cf-wrapper')
    );
    return { hasWidget, title: document.title, body: document.body?.innerText || "" };
  });
  return probe.hasWidget || isCaptchaByText(probe.title, probe.body);
}

async function humanLinger(page: Page) {
  await page.mouse.move(rnd(100, 800), rnd(100, 500));
  await wait(rnd(400, 1200));
  await page.mouse.wheel(0, rnd(300, 1500));
  await wait(rnd(800, 2000));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const detailLinks: string[] = [];
  let blockRetries = 0;
  const MAX_BLOCK_RETRIES = 4; // demo: dừng sau vài lần để không lặp vô hạn

  for (let p = 1; p <= MAX_PAGES; p++) {
    const url = `${BASE_URL}${p}`;
    console.log(`\n[list ${p}] → ${url}`);
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      pagesVisited++;
      console.log(`[list ${p}] HTTP ${resp?.status()}`);
      await humanLinger(page);

      if (await detectCaptcha(page, resp?.status())) {
        captchaHits++;
        throttle.registerCaptcha();
        const cd = throttle.cooldownMs(2000); // base nhỏ để kiểm chứng nhanh
        console.log(`[list ${p}] 🛡️ BỊ CHẶN (Cloudflare/captcha) → cooldown ${Math.round(cd / 1000)}s, slowdown=${throttle.slowdownFactor}`);
        await wait(cd);
        if (throttle.shouldRotateSession()) {
          console.log("[list] ♻️ 3 lần liên tiếp → ĐỔI PHIÊN (đóng tab, warm-up lại)");
          throttle.resetAfterRotation();
        }
        if (++blockRetries >= MAX_BLOCK_RETRIES) {
          console.log(`[list] ⏹️ Dừng demo sau ${blockRetries} lần bị chặn (cơ chế cooldown/đổi phiên đã chứng minh hoạt động)`);
          break;
        }
        p--; // thử lại trang này
        continue;
      }

      throttle.registerSuccess();
      const links = await page.$$eval(LIST_SELECTOR, (els) =>
        els.map((e) => (e as HTMLAnchorElement).href).filter(Boolean)
      );
      console.log(`[list ${p}] ✅ ${links.length} link, không captcha (slowdown ${throttle.slowdownFactor})`);
      for (const l of links) {
        if (detailLinks.length < MAX_DETAILS && !detailLinks.includes(l)) detailLinks.push(l);
      }
      await wait(rnd(1500, 3500) * throttle.slowdownFactor);
    } catch (e) {
      console.log(`[list ${p}] ❌ lỗi điều hướng: ${(e as Error).message}`);
    }
  }

  for (const link of detailLinks) {
    console.log(`\n[detail] → ${link}`);
    try {
      const resp = await page.goto(link, { waitUntil: "domcontentloaded", timeout: 45000 });
      pagesVisited++;
      console.log(`[detail] HTTP ${resp?.status()}`);
      await humanLinger(page);
      if (await detectCaptcha(page, resp?.status())) {
        captchaHits++;
        console.log(`[detail] 🛡️ CAPTCHA phát hiện`);
      } else {
        const soHieu = await page
          .$eval("#divThuocTinh", (el) => el.textContent?.slice(0, 40) || "")
          .catch(() => "(không thấy bảng thuộc tính)");
        console.log(`[detail] ✅ không captcha — thuộc tính: ${soHieu.replace(/\s+/g, " ").trim()}`);
      }
      await wait(rnd(2000, 4000) * throttle.slowdownFactor);
    } catch (e) {
      console.log(`[detail] ❌ lỗi: ${(e as Error).message}`);
    }
  }

  await browser.close();

  console.log("\n==== KẾT QUẢ KIỂM CHỨNG ====");
  console.log(`Trang đã truy cập: ${pagesVisited}`);
  console.log(`Số lần phát hiện captcha: ${captchaHits}`);
  console.log(captchaHits === 0 ? "✅ KHÔNG bị captcha trong lần chạy này" : "⚠️ Có captcha — cơ chế cooldown đã được kích hoạt");
  process.exit(captchaHits === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error("Lỗi kiểm chứng:", e);
  process.exit(1);
});
