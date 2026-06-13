// Kiểm chứng sát nhất: khởi chạy chrome.exe như TIẾN TRÌNH BÌNH THƯỜNG (không qua
// Playwright launch → KHÔNG có cờ --enable-automation / navigator.webdriver), rồi
// ATTACH qua CDP để quan sát. Đây là cách Chrome trông như do người dùng mở, nên
// thường vượt được Cloudflare — cho phép kiểm tra luồng crawl thật có gặp Google
// captcha hay không.
//
// Chạy: node --experimental-strip-types scripts/verify-cdp-attach.ts
import { chromium, type Page } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { isCaptchaByText } from "../src/utils/anti-detection.ts";

const URL =
  "https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=&area=0&type=0&status=0&lan=1&org=0&signer=0&match=True&sort=1&bdate=16/03/2025&edate=02/07/2025&page=1";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const DIST = path.resolve("dist");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function probe(page: Page) {
  const p = await page.evaluate(() => {
    const vis = (el: Element | null) => {
      const h = el as HTMLElement | null;
      return !!h && h.offsetParent !== null && h.offsetWidth > 50 && h.offsetHeight > 50;
    };
    return {
      title: document.title,
      bodyLen: (document.body?.innerText || "").length,
      body: (document.body?.innerText || "").slice(0, 200000),
      // Chỉ tính reCAPTCHA khi checkbox THỰC SỰ hiển thị (không tính widget login nghỉ)
      hasRecaptcha: vis(document.querySelector('iframe[src*="recaptcha/api2/anchor"]')) ||
        vis(document.querySelector('iframe[src*="challenges.cloudflare.com"]')),
      links: Array.from(document.querySelectorAll("p.nqTitle a")).map(
        (a) => (a as HTMLAnchorElement).href
      ),
    };
  });
  const tl = p.title.toLowerCase();
  const cf = tl.includes("just a moment") || tl.includes("chờ một chút") || tl.includes("đang kiểm tra");
  const captcha = p.hasRecaptcha || isCaptchaByText(p.title, p.body);
  return { ...p, cf, captcha };
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vbpl-cdp-"));
  const child = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      "--lang=vi",
      URL,
    ],
    { detached: false, stdio: "ignore" }
  );

  try {
    // Chờ Chrome khởi động + Cloudflare tự giải JS challenge
    console.log("⏳ Khởi chạy Chrome bình thường, chờ Cloudflare tự giải...");
    await wait(12000);

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    const ctx = browser.contexts()[0];
    // Tìm tab của trang đích
    let page = ctx.pages().find((pg) => pg.url().includes("thuvienphapluat.vn"));
    if (!page) page = ctx.pages()[0];

    let r = await probe(page);
    console.log(`[1] title="${r.title}" | bodyLen=${r.bodyLen} | cf=${r.cf} | recaptcha=${r.hasRecaptcha} | links=${r.links.length}`);

    // Nếu vẫn ở challenge, chờ thêm + reload vài lần như người thật
    for (let i = 0; i < 3 && r.cf && r.links.length === 0; i++) {
      console.log(`   ⏳ Vẫn ở Cloudflare, chờ thêm (lần ${i + 1})...`);
      await wait(8000);
      r = await probe(page);
      console.log(`   → title="${r.title}" | bodyLen=${r.bodyLen} | cf=${r.cf} | links=${r.links.length}`);
    }

    let detailRecaptcha = false;
    let detailOk = false;
    if (!r.cf && r.links.length > 0) {
      // Đã qua Cloudflare → vào 1 trang chi tiết kiểm tra Google captcha trong luồng crawl
      const detailUrl = r.links[0];
      console.log(`\n[2] Vào trang chi tiết: ${detailUrl}`);
      await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await wait(5000);
      const d = await probe(page);
      detailRecaptcha = d.hasRecaptcha;
      detailOk = !d.cf && !d.captcha;
      console.log(`[2] title="${d.title}" | cf=${d.cf} | recaptcha=${d.hasRecaptcha} | captcha=${d.captcha}`);
    }

    await browser.close();

    console.log("\n==== KẾT QUẢ (Chrome bình thường + attach CDP) ====");
    if (r.cf && r.links.length === 0) {
      console.log("🟠 Không qua được Cloudflare ngay cả khi chạy Chrome bình thường (IP/phiên có thể đã bị gắn cờ).");
      console.log("   → Đây là chặn Cloudflare, KHÔNG phải Google captcha.");
      process.exit(3);
    }
    console.log(`✅ QUA Cloudflare: trang danh sách có ${r.links.length} link văn bản.`);
    console.log(`Google reCAPTCHA ở trang danh sách: ${r.hasRecaptcha ? "CÓ" : "KHÔNG"}`);
    if (detailOk) console.log(`✅ Trang chi tiết vào được, Google reCAPTCHA: ${detailRecaptcha ? "CÓ" : "KHÔNG"}`);
    const anyCaptcha = r.captcha || detailRecaptcha;
    console.log(anyCaptcha ? "⚠️ Có gặp captcha trong luồng crawl" : "✅ Luồng crawl KHÔNG gặp Google captcha");
    process.exit(anyCaptcha ? 2 : 0);
  } finally {
    try { child.kill(); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error("Lỗi:", e); process.exit(1); });
