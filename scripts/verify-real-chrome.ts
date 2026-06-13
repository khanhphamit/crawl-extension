// Kiểm chứng runtime sát thực tế nhất: Chrome THẬT (channel chrome), CÓ giao diện
// (headed), NẠP extension đã build (dist/) — đúng ngữ cảnh extension chạy.
// Mục tiêu: vượt Cloudflare "Just a moment" và quan sát có Google captcha hay không.
//
// Chạy: node --experimental-strip-types scripts/verify-real-chrome.ts
import { chromium, type Page } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { isCaptchaByText } from "../src/utils/anti-detection.ts";

const BASE_URL =
  "https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=&area=0&type=0&status=0&lan=1&org=0&signer=0&match=True&sort=1&bdate=16/03/2025&edate=02/07/2025&page=";
const LIST_SELECTOR = "p.nqTitle a";
const MAX_PAGES = Number(process.env.MAX_PAGES || 2);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

async function detect(page: Page, status?: number) {
  await wait(2500); // chờ Cloudflare challenge tự giải (headed thường qua được)
  const probe = await page.evaluate(() => ({
    title: document.title,
    body: (document.body?.innerText || "").slice(0, 200000),
    hasRecaptcha: !!document.querySelector('iframe[src*="recaptcha"], .g-recaptcha, [data-sitekey]'),
  }));
  const tl = probe.title.toLowerCase();
  const cf = tl.includes("just a moment") || tl.includes("chờ một chút") || tl.includes("đang kiểm tra");
  const captcha = probe.hasRecaptcha || isCaptchaByText(probe.title, probe.body);
  return { cf, captcha, hasRecaptcha: probe.hasRecaptcha, title: probe.title, status };
}

async function main() {
  const distPath = path.resolve("dist");
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vbpl-verify-"));

  const ctx = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1366, height: 768 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  });

  let captchaHits = 0;
  let cfHits = 0;
  let contentReached = 0;
  const page = ctx.pages()[0] || (await ctx.newPage());

  for (let p = 1; p <= MAX_PAGES; p++) {
    const url = `${BASE_URL}${p}`;
    console.log(`\n[list ${p}] → page=${p}`);
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const status = resp?.status();
      // Cloudflare: thử chờ thêm và reload một lần nếu vẫn ở interstitial
      let d = await detect(page, status);
      if (d.cf) {
        console.log(`[list ${p}] ⏳ Cloudflare challenge, chờ tự giải...`);
        await wait(6000);
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        d = await detect(page, status);
      }

      await page.mouse.move(rnd(100, 900), rnd(100, 500));
      await page.mouse.wheel(0, rnd(400, 1500));
      await wait(rnd(1500, 3000));

      if (d.hasRecaptcha) {
        captchaHits++;
        console.log(`[list ${p}] 🛡️ GOOGLE reCAPTCHA phát hiện trên trang`);
      } else if (d.cf) {
        cfHits++;
        console.log(`[list ${p}] 🟠 Vẫn ở Cloudflare challenge (HTTP ${d.status}) — chưa qua được`);
      } else if (d.captcha) {
        captchaHits++;
        console.log(`[list ${p}] 🛡️ Trang xác minh/captcha (title="${d.title}")`);
      } else {
        const links = await page.$$eval(LIST_SELECTOR, (els) =>
          els.map((e) => (e as HTMLAnchorElement).href).filter(Boolean)
        );
        contentReached++;
        console.log(`[list ${p}] ✅ QUA Cloudflare, HTTP ${d.status}, ${links.length} link văn bản, KHÔNG captcha (title="${d.title}")`);
      }
      await wait(rnd(2000, 4000));
    } catch (e) {
      console.log(`[list ${p}] ❌ ${(e as Error).message}`);
    }
  }

  await ctx.close();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}

  console.log("\n==== KẾT QUẢ (Chrome thật + extension) ====");
  console.log(`Trang vào được nội dung thật: ${contentReached}/${MAX_PAGES}`);
  console.log(`Google reCAPTCHA / trang xác minh: ${captchaHits}`);
  console.log(`Còn kẹt Cloudflare challenge: ${cfHits}`);
  if (captchaHits === 0 && contentReached > 0) {
    console.log("✅ Vào được nội dung mà KHÔNG gặp Google captcha");
    process.exit(0);
  } else if (captchaHits > 0) {
    console.log("⚠️ Gặp captcha — cần xoay IP / giảm nhịp");
    process.exit(2);
  } else {
    console.log("🟠 Không qua được Cloudflare trong lần chạy này (không phải Google captcha)");
    process.exit(3);
  }
}

main().catch((e) => { console.error("Lỗi:", e); process.exit(1); });
