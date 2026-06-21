// Kiểm chứng END-TO-END: chạy ĐÚNG luồng crawl của extension (popup → background)
// cho 4 trang, trên Chrome thật (spawn chrome.exe + connectOverCDP để qua Cloudflare).
//
// - KHÔNG đụng backend: đặt batchSize rất lớn nên trong 4 trang KHÔNG gọi API
//   (chỉ lần flush cuối sau vòng lặp mới thử gọi localhost:8909 và sẽ lỗi — bỏ qua).
// - Theo dõi tiến độ bằng cách poll GET_STATUS của background (currentPage,
//   collectedLinks, savedRecords, statusText, 3 dòng log gần nhất).
//
// Chạy: node --experimental-strip-types scripts/verify-crawl-4pages.ts
import { chromium, type Worker } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { CrawlConfig } from "../src/config/default-config.ts";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9335;
const DIST = path.resolve("dist");
const MAX_PAGE = 4;
const POLL_MS = 4000;
const TIMEOUT_MS = 45 * 60 * 1000; // tối đa 45 phút

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Config truyền cho background: y như extension, chỉ đổi minPage/maxPage và batchSize lớn.
const crawlConfig = {
  ...CrawlConfig,
  pagination: { ...CrawlConfig.pagination, minPage: 1, maxPage: MAX_PAGE },
  batch: { ...CrawlConfig.batch, batchSize: 100000 },
};

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vbpl-crawl4-"));
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
      "about:blank",
    ],
    { detached: false, stdio: "ignore" }
  );

  try {
    console.log("⏳ Khởi chạy Chrome + nạp extension...");
    await wait(6000);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    const ctx = browser.contexts()[0];

    // Lấy extension id qua CDP Target.getTargets (service worker của extension
    // không phải lúc nào cũng hiện trong ctx.serviceWorkers() khi connectOverCDP).
    const cdp = await browser.newBrowserCDPSession();
    let extId = "";
    for (let i = 0; i < 20 && !extId; i++) {
      const { targetInfos } = (await cdp.send("Target.getTargets")) as any;
      const swt = targetInfos.find(
        (t: any) => t.url.includes("chrome-extension://") && /service_worker|background_page/.test(t.type)
      );
      if (swt) {
        extId = new URL(swt.url).host;
      } else if (i === 5) {
        console.log("   (debug) targets:", targetInfos.map((t: any) => `${t.type}:${t.url}`).slice(0, 10).join(" | "));
      }
      if (!extId) await wait(1000);
    }
    if (!extId) throw new Error("Không tìm thấy service worker của extension");
    console.log(`✅ Extension id: ${extId}`);

    // Bắt log của service worker (background) nếu Playwright có expose
    const sw: Worker | undefined = ctx.serviceWorkers().find((w) => w.url().includes(extId));
    sw?.on("console", (m) => {
      const t = m.text();
      if (t.startsWith("Building page URL")) return;
      console.log(`   [SW] ${t}`);
    });

    // Mở 1 trang extension (có chrome.runtime ở main world) để gửi START/GET_STATUS.
    // options.html có open_in_tab:true nên chắc chắn điều hướng được; nếu không thì thử index.html.
    const popup = await ctx.newPage();
    try {
      await popup.goto(`chrome-extension://${extId}/options.html`, { waitUntil: "domcontentloaded" });
    } catch {
      await popup.goto(`chrome-extension://${extId}/index.html`, { waitUntil: "domcontentloaded" });
    }
    await wait(1500);
    const hasRuntime = await popup.evaluate(() => typeof chrome !== "undefined" && !!chrome.runtime?.sendMessage);
    if (!hasRuntime) throw new Error("Trang extension không có chrome.runtime (không gửi được START)");

    console.log(`🚀 Gửi START (minPage=1, maxPage=${MAX_PAGE}, batchSize lớn → không gọi backend)\n`);
    await popup.evaluate((cfg) => {
      return chrome.runtime.sendMessage({ type: "START", config: cfg, resumeFromSaved: false });
    }, crawlConfig as any);

    // Poll GET_STATUS đến khi crawl xong (isRunning false sau khi đã chạy) hoặc timeout
    const start = Date.now();
    let started = false;
    let last = "";
    let final: any = null;

    while (Date.now() - start < TIMEOUT_MS) {
      await wait(POLL_MS);
      let st: any;
      try {
        st = await popup.evaluate(() =>
          chrome.runtime.sendMessage({ type: "GET_STATUS" })
        );
      } catch (e) {
        console.log(`   (popup mất kết nối tạm: ${(e as Error).message})`);
        continue;
      }
      if (!st) continue;

      const line = `p=${st.currentPage}/${st.totalPages} | links=${st.collectedLinks} | saved=${st.savedRecords} | ${st.isRunning ? "▶️" : "⏹️"}${st.isPaused ? "(paused)" : ""} | ${st.statusText?.split("\n")[0] ?? ""}`;
      if (line !== last) {
        const elapsed = Math.round((Date.now() - start) / 1000);
        console.log(`[${elapsed}s] ${line}`);
        last = line;
      }

      if (st.isRunning) started = true;
      if (started && !st.isRunning) {
        final = st;
        break;
      }
    }

    console.log("\n==== KẾT QUẢ CRAWL 4 TRANG ====");
    if (!started) {
      console.log("🟠 Crawl không bao giờ chạy (background không nhận START?).");
      await browser.close();
      process.exit(3);
    }
    if (!final) {
      console.log("⏱️ Hết thời gian chờ — crawl vẫn đang chạy (có thể đang cooldown/nghỉ phiên).");
      const st = await popup.evaluate(() => chrome.runtime.sendMessage({ type: "GET_STATUS" })).catch(() => null);
      console.log("   Trạng thái cuối:", JSON.stringify(st));
      await browser.close();
      process.exit(2);
    }

    console.log(`Trang đã qua: ${final.currentPage}/${final.totalPages}`);
    console.log(`Tổng link thu thập: ${final.collectedLinks}`);
    console.log(`Records hợp lệ (đủ số hiệu/loại VB): ${final.collectedLinks ? "xem log SW" : 0}`);
    console.log(`Status cuối: ${final.statusText}`);
    console.log(`Log gần nhất:`);
    (final.logs || []).forEach((l: string) => console.log(`   ${l}`));

    await browser.close();
    process.exit(0);
  } finally {
    try { child.kill(); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error("Lỗi:", e); process.exit(1); });
