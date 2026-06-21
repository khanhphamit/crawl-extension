// Kiểm chứng luồng thu thập danh sách trên Chrome THẬT của người dùng (spawn
// chrome.exe + attach CDP — cách qua Cloudflare đáng tin nhất). Mục tiêu:
//  1) Qua được Cloudflare, trang danh sách có link.
//  2) itemContainer khớp ĐÚNG từng item (mỗi item 1 link, không gộp/trùng).
//  3) Các cột ngày/tình trạng đọc theo TỪNG item (sau khi sửa bug document-scoped)
//     → giá trị KHÁC nhau giữa các item, không bị gán giống item đầu.
//
// Chạy: node --experimental-strip-types scripts/verify-list-fields.ts
import { chromium, type Page } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { CrawlConfig } from "../src/config/default-config.ts";
import { isCaptchaByText } from "../src/utils/anti-detection.ts";

const URL =
  "https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=&area=0&type=0&status=0&lan=1&org=0&signer=0&match=True&sort=1&bdate=16/03/2025&edate=02/07/2025&page=1";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9334;
const DIST = path.resolve("dist");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function probe(page: Page, sel: typeof CrawlConfig.listPageSelectors) {
  return page.evaluate((sel) => {
    const itemEls = Array.from(document.querySelectorAll(sel.itemContainer));
    const within = (root: Element, s: string) =>
      (root.querySelector(s)?.textContent || "").trim();

    const items = itemEls.slice(0, 6).map((item) => {
      const a = item.querySelector(sel.linkSelector) as HTMLAnchorElement | null;
      const lawIdEl = item.querySelector(sel.lawIdSelector);
      return {
        link: a?.href || "",
        lawId: lawIdEl?.getAttribute(sel.lawIdAttribute) || null,
        name: (a?.textContent || "").trim().slice(0, 50),
        ban_hanh: within(item, ".right-col p:nth-child(1)"),
        hieu_luc: within(item, ".right-col p:nth-child(2)"),
        tinh_trang: within(item, ".right-col p:nth-child(3)"),
        cap_nhat: within(item, ".right-col p:nth-child(4)"),
      };
    });

    // So sánh: cách CŨ (document-scoped) lấy cùng 1 giá trị cho mọi item
    const docScoped = {
      ban_hanh: (document.querySelector(".right-col p:nth-child(1)")?.textContent || "").trim(),
      cap_nhat: (document.querySelector(".right-col p:nth-child(4)")?.textContent || "").trim(),
    };

    return {
      title: document.title,
      bodyLen: (document.body?.innerText || "").length,
      body: (document.body?.innerText || "").slice(0, 4000),
      itemCount: itemEls.length,
      links: Array.from(document.querySelectorAll("p.nqTitle a")).length,
      items,
      docScoped,
    };
  }, sel);
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vbpl-fields-"));
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
    console.log("⏳ Mở Chrome thật + nạp extension, chờ Cloudflare tự giải...");
    await wait(12000);

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    const ctx = browser.contexts()[0];
    let page = ctx.pages().find((pg) => pg.url().includes("thuvienphapluat.vn")) || ctx.pages()[0];

    let r = await probe(page, CrawlConfig.listPageSelectors);
    for (let i = 0; i < 3 && r.links === 0; i++) {
      console.log(`   ⏳ Chưa có link (Cloudflare?), chờ thêm lần ${i + 1}...`);
      await wait(8000);
      r = await probe(page, CrawlConfig.listPageSelectors);
    }

    const cf = isCaptchaByText(r.title, r.body);
    console.log(`\n[trang danh sách] title="${r.title}"`);
    console.log(`  itemContainer khớp: ${r.itemCount} item | p.nqTitle a: ${r.links} link | captcha=${cf}`);

    if (r.links === 0) {
      console.log("🟠 Không qua được Cloudflare lần này (IP/phiên bị gắn cờ). Không phải bug extension.");
      await browser.close();
      process.exit(3);
    }

    console.log("\n  Mẫu dữ liệu per-item (sau khi sửa scope):");
    r.items.forEach((it, i) => {
      console.log(`   #${i + 1} [${it.lawId ?? "?"}] ${it.name}`);
      console.log(`        ban_hanh=${it.ban_hanh} | hieu_luc=${it.hieu_luc} | cap_nhat=${it.cap_nhat} | tinh_trang=${it.tinh_trang.slice(0, 40)}`);
    });

    // Kiểm tra fix: các item phải có cap_nhat/ban_hanh KHÁC nhau (không bị gán giống item đầu)
    const capNhatSet = new Set(r.items.map((i) => i.cap_nhat).filter(Boolean));
    const allLinksUnique = new Set(r.items.map((i) => i.link)).size === r.items.length;
    console.log(`\n  docScoped (cách cũ) cap_nhat = "${r.docScoped.cap_nhat}" (luôn của item đầu)`);
    console.log(`  per-item cap_nhat phân biệt: ${capNhatSet.size} giá trị khác nhau / ${r.items.length} item`);
    console.log(`  link mỗi item là duy nhất: ${allLinksUnique ? "✅" : "⚠️ có trùng (itemContainer sai)"}`);

    await browser.close();

    const fixOk = capNhatSet.size > 1 && allLinksUnique;
    console.log("\n==== KẾT QUẢ ====");
    if (cf) {
      console.log("⚠️ Trang báo challenge/captcha — kiểm tra lại sau.");
      process.exit(2);
    }
    console.log(fixOk
      ? "✅ Selector per-item hoạt động đúng: mỗi item có link + ngày/tình trạng riêng."
      : "⚠️ Dữ liệu per-item vẫn trùng — cần xem lại itemContainer/selector cột.");
    process.exit(fixOk ? 0 : 2);
  } finally {
    try { child.kill(); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error("Lỗi:", e); process.exit(1); });
