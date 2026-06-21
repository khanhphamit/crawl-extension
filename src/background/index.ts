import { sleep, randomDelay } from "../utils/sleep";
import { AntiDetectionThrottle, isCaptchaByText } from "../utils/anti-detection";
import { saveCrawlDataToApi, CrawlItem, logCrawlItem } from "../utils/api-helper";
import { CrawlConfig } from "../config/default-config";
import {
  saveCrawlSession,
  clearCrawlSession,
  generateConfigHash,
  getResumableSession,
  type CrawlSessionData,
} from "../utils/crawl-persistence";

// ==== Types ====
type DetailData = {
  so_hieu: string;
  loai_van_ban: string;
  noi_ban_hanh: string;
  ngay_ban_hanh: string;
  ngay_hieu_luc: string;
  ngay_cap_nhat: string;
  tinh_trang_hieu_luc: string;
  content: string;
  source_url: string;
  luoc_do_html: string;
  luoc_do_links: string[];
  vanbanBiBaiBo: string[];
  vanbanBaiBo: string[];
  vanbanSuaDoi: string[];
  vanbanBiSuaDoi: string[];
  vanbanDuocHuongDan: string[];
  vanbanHuongDan: string[];
  vanbanBiDinhChinh: string[];
  vanbanDinhChinh: string[];
  vanbanDuocHopNhat: string[];
  vanbanHopNhat: string[];
};

type LinkItem = {
  link: string;
  lawId: string | null;
  name: string;
  ban_hanh: string;
  hieu_luc: string;
  tinh_trang: string;
  cap_nhat: string;
};

type CollectResult = {
  captcha: boolean;
  data: LinkItem[];
};

type CrawlSessionState = {
  isRunning: boolean;
  isPaused: boolean;
  currentPage: number;
  totalPages: number;
  collectedLinks: number;
  savedRecords: number;
};

type MessagePayload = {
  type: string;
  [key: string]: any;
};

// ==== Global state ====
const sessionState: CrawlSessionState = {
  isRunning: false,
  isPaused: false,
  currentPage: 0,
  totalPages: 0,
  collectedLinks: 0,
  savedRecords: 0,
};

let currentTabId: number | null = null;

// Nhớ thông báo status gần nhất để popup mở lại vẫn thấy (notifyUI chỉ tới được
// popup khi nó đang mở; GET_STATUS dùng giá trị này thay vì rỗng).
let lastStatusText = "";

// 3 dòng log hoạt động gần nhất để hiển thị trên UI popup (đang ở trang/hàm nào).
const recentLogs: string[] = [];
let lastLoggedMessage = "";
function pushLog(message: string): void {
  if (message === lastLoggedMessage) return; // bỏ qua log trùng liên tiếp
  lastLoggedMessage = message;
  const t = new Date().toLocaleTimeString();
  recentLogs.push(`[${t}] ${message}`);
  while (recentLogs.length > 3) recentLogs.shift();
  chrome.runtime.sendMessage({ type: "LOG", logs: [...recentLogs] }).catch(() => {});
}

// MV3: service worker bị Chrome tắt sau ~30s không có sự kiện, và setTimeout KHÔNG
// giữ nó sống. Vì vậy sleep dài (nghỉ phiên, cooldown) làm crawl CHẾT ÂM THẦM:
// hết log, UI đứng, state mất. keepAliveSleep cắt thời gian nghỉ thành đoạn ≤20s,
// sau mỗi đoạn gọi 1 API extension để reset idle-timer → giữ worker sống.
async function keepAliveSleep(ms: number): Promise<void> {
  const CHUNK = 20000;
  let remaining = ms;
  while (remaining > 0) {
    const wait = Math.min(CHUNK, remaining);
    await sleep(wait);
    remaining -= wait;
    try {
      await chrome.runtime.getPlatformInfo();
    } catch {
      // ignore
    }
  }
}

// ==== Session break tracking ====
let pagesSinceBreak = 0;
let nextBreakAt = Math.floor(Math.random() * 3) + 2; // 2-4 trang

// ==== Adaptive anti-detection throttle ====
// Khi site bắt đầu thử thách (captcha/Cloudflare), ta phải HẠ NHIỆT thay vì
// tiếp tục nã request — đây là yếu tố quyết định để không bị gắn cờ nặng hơn.
// Logic thuần nằm trong AntiDetectionThrottle để kiểm thử được.
const throttle = new AntiDetectionThrottle();

// Xử lý khi bị challenge: hiện tab, nghỉ lũy thừa, và đổi phiên nếu liên tục bị chặn
async function handleCaptchaCooldown(
  config: typeof CrawlConfig,
  label: string
): Promise<void> {
  throttle.registerCaptcha();
  const waitMs = throttle.cooldownMs(config.delay.captchaWaitTime);
  logProgress(`🛡️ ${label} - challenge lần ${throttle.consecutiveCaptchas}. Cooldown ${Math.round(waitMs / 1000)}s...`);
  notifyUI(`🛡️ Bị chặn (${label}). Nghỉ ${Math.round(waitMs / 1000)}s để hạ nhiệt...`);

  // Hiện tab: trạng thái visible + focus giúp điểm reCAPTCHA cao hơn,
  // đồng thời cho phép người dùng giải tay nếu cần.
  if (currentTabId !== null) {
    chrome.tabs.update(currentTabId, { active: true }).catch(() => {});
  }
  await keepAliveSleep(waitMs);

  // Sau N lần liên tiếp: bỏ phiên hiện tại, mở tab mới + warm-up lại như người mới vào
  if (throttle.shouldRotateSession()) {
    logProgress("♻️ Đổi phiên: đóng tab và warm-up lại...");
    notifyUI("♻️ Đổi phiên để tránh bị theo dõi...");
    if (currentTabId !== null) {
      await chrome.tabs.remove(currentTabId).catch(() => {});
      currentTabId = null;
    }
    throttle.resetAfterRotation();
    // Nghỉ thêm 30-60s trước khi bắt đầu phiên mới
    await keepAliveSleep(Math.floor(Math.random() * 30000) + 30000);
    await warmupSession(config);
  }
}

async function maybeTakeSessionBreak(): Promise<void> {
  pagesSinceBreak++;
  if (pagesSinceBreak < nextBreakAt) return;

  // Nghỉ 1-2 phút để giống người dùng thật
  const breakMs = Math.floor(Math.random() * 60000) + 60000;
  logProgress(`☕ Nghỉ ${Math.round(breakMs / 1000)}s sau ${pagesSinceBreak} trang (tránh bot detection)...`);
  notifyUI(`☕ Nghỉ ${Math.round(breakMs / 1000)}s...`);
  await keepAliveSleep(breakMs);

  pagesSinceBreak = 0;
  nextBreakAt = Math.floor(Math.random() * 3) + 2;

  // Đôi khi đóng và mở lại tab sau khi nghỉ
  if (Math.random() < 0.4 && currentTabId !== null) {
    chrome.tabs.remove(currentTabId).catch(() => {});
    currentTabId = null;
  }
}

// ==== Helper functions ====
function logProgress(message: string, data?: any) {
  const timestamp = new Date().toLocaleTimeString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
  pushLog(message);
}

async function waitIfPaused(): Promise<void> {
  while (sessionState.isPaused && sessionState.isRunning) {
    await sleep(500);
  }
}

function buildPageUrl(baseUrl: string, page: number): string {
  console.log("Building page URL:", { baseUrl, page });
  if (baseUrl.includes("page=")) {
    return baseUrl.replace(/page=[^&]*/, `page=${page}`);
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}page=${page}`;
}

function notifyUI(statusText: string) {
  lastStatusText = statusText;
  pushLog(statusText);
  chrome.runtime.sendMessage({
    type: "STATUS",
    statusText,
    logs: [...recentLogs],
    ...sessionState,
  }).catch(() => {
    // Popup might be closed
  });
}

async function waitForTabComplete(tabId: number, timeout: number = 30000): Promise<void> {
  return new Promise((resolve) => {

    const listener = (updatedTabId: number, changeInfo: any) => {
      if (updatedTabId !== tabId) return;

      if (changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeoutId);
        resolve();
      }
    };

    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeout);

    chrome.tabs.onUpdated.addListener(listener);

    // Check if already loaded
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeoutId);
        resolve();
      }
    });
  });
}

// ==== Session warm-up (anti-bot) ====
async function warmupSession(config: typeof CrawlConfig): Promise<void> {
  try {
    const origin = new URL(config.url.baseUrl).origin;
    logProgress(`🏠 Warm-up session tại ${origin}...`);
    notifyUI("🏠 Khởi động session...");

    if (currentTabId === null) {
      const tab = await chrome.tabs.create({ url: origin, active: false });
      currentTabId = tab.id ?? null;
    } else {
      await chrome.tabs.update(currentTabId, { url: origin });
    }

    if (!currentTabId) return;

    await waitForTabComplete(currentTabId, 20000);
    // Ở lại homepage 3-7s như người dùng thật
    await sleep(Math.floor(Math.random() * 4000) + 3000);
    // Browse 1-2 link trên homepage
    await randomExploration(origin, config);
    await sleep(Math.floor(Math.random() * 2000) + 1500);

    logProgress("✅ Warm-up session xong");
  } catch {
    logProgress("⚠️ Warm-up thất bại, tiếp tục...");
  }
}

// ==== Random exploration (anti-bot) ====
async function randomExploration(returnUrl: string, config: typeof CrawlConfig): Promise<void> {
  if (!currentTabId) return;
  // Chỉ thực hiện 40% số lần để không quá chậm
  if (Math.random() > 0.4) return;

  try {
    const links = await chrome.tabs.sendMessage(currentTabId, {
      type: "GET_RANDOM_LINKS",
    }) as string[];

    if (!links || links.length === 0) return;

    const count = Math.floor(Math.random() * 2) + 1; // 1-2 link
    for (let i = 0; i < Math.min(count, links.length); i++) {
      const link = links[Math.floor(Math.random() * links.length)];
      logProgress(`🔀 Browse random: ${link}`);
      await chrome.tabs.update(currentTabId, { url: link });
      await waitForTabComplete(currentTabId, 15000);
      // Scroll và đọc như người thật
      await sleep(Math.floor(Math.random() * 4000) + 2000);
    }

    // Quay lại trang gốc
    await chrome.tabs.update(currentTabId, { url: returnUrl });
    await waitForTabComplete(currentTabId, config.delay.pageLoadTimeout);
    await sleep(Math.floor(Math.random() * 1000) + 500);
  } catch {
    // Exploration thất bại, bỏ qua và tiếp tục
  }
}

// ==== Crawling functions ====
async function collectLinksFromPage(
  tabId: number,
  config: typeof CrawlConfig
): Promise<CollectResult> {
  try {
    logProgress(`📋 Gửi yêu cầu COLLECT tới tab ${tabId}`);

    const data = (await chrome.tabs.sendMessage(tabId, {
      type: "COLLECT",
      config,
    })) as CollectResult;

    if (!data) {
      logProgress("⚠️ Không nhận được dữ liệu từ COLLECT");
      return { captcha: false, data: [] };
    }

    if (data.captcha) {
      logProgress("⚠️ Phát hiện captcha trên trang danh sách");
      return { captcha: true, data: [] };
    }

    logProgress(`✅ Nhận được ${data.data.length} links`);
    return { captcha: false, data: data.data };
  } catch (error) {
    // Chỉ coi là bị chặn nếu title tab xác nhận Cloudflare; còn lại là lỗi tạm
    // (tab điều hướng giữa chừng / content script chưa sẵn sàng) → không cooldown.
    const blocked = await isTabBlockedByTitle(tabId);
    if (blocked) {
      logProgress("⚠️ COLLECT: trang chặn Cloudflare (title)");
      return { captcha: true, data: [] };
    }
    logProgress(`❌ Lỗi COLLECT (lỗi tạm): ${(error as Error).message}`);
    return { captcha: false, data: [] };
  }
}

async function fetchDetailData(
  tabId: number,
  config: typeof CrawlConfig
): Promise<{ data: DetailData | null; captcha: boolean }> {
  try {
    const detail = (await chrome.tabs.sendMessage(tabId, {
      type: "DETAIL",
      config,
    })) as DetailData | { __captcha: true } | null;

    if (detail && (detail as { __captcha?: boolean }).__captcha) {
      logProgress("🛡️ Content script báo captcha trên trang chi tiết");
      return { data: null, captcha: true };
    }

    if (!detail) {
      logProgress("⚠️ Không nhận được dữ liệu chi tiết");
      return { data: null, captcha: false };
    }

    return { data: detail as DetailData, captcha: false };
  } catch (error) {
    // Chỉ coi là captcha nếu title tab xác nhận trang chặn Cloudflare; còn lại là
    // lỗi tạm (thường do tab điều hướng giữa chừng) → để retry thường, KHÔNG cooldown.
    const blocked = await isTabBlockedByTitle(tabId);
    if (!blocked) {
      logProgress(`⚠️ DETAIL không phản hồi (lỗi tạm, sẽ thử lại): ${(error as Error).message}`);
    }
    return { data: null, captcha: blocked };
  }
}

// Khi sendMessage tới content script lỗi, KHÔNG đoán mò là captcha qua thông điệp
// lỗi (lỗi "message channel closed" thường chỉ do tab điều hướng giữa chừng / race,
// KHÔNG phải bị chặn). Thay vào đó đọc title của tab (background đọc được mà không
// cần content script) để xác nhận đây có thật là trang chặn Cloudflare hay không.
async function isTabBlockedByTitle(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return isCaptchaByText(tab.title || "", "");
  } catch {
    return false;
  }
}

function hasRequiredFields(detail: DetailData | null): boolean {
  if (!detail) return false;
  // Các trường quan trọng: số hiệu và loại văn bản
  const soHieuOk = detail.so_hieu.trim().length > 0;
  const loaiVbOk = detail.loai_van_ban.trim().length > 0;
  return soHieuOk && loaiVbOk;
}

async function saveAndSendBatch(
  items: CrawlItem[],
  config: typeof CrawlConfig
): Promise<boolean> {
  if (items.length === 0) return true;

  logProgress(`📤 Gửi batch ${items.length} records tới API`);

  for (const item of items) {
    logCrawlItem(item, config.logging.excludeFieldsFromLog);
  }

  const result = await saveCrawlDataToApi(
    items,
    config.url.apiEndpoint,
    config.batch.apiTimeout
  );

  if (result.success) {
    sessionState.savedRecords += items.length;
    logProgress(`✅ Lưu thành công ${items.length} records`);
    return true;
  } else {
    logProgress(`❌ Lỗi lưu batch:`, result.message);
    return false;
  }
}

// ==== Main crawl function ====
async function startCrawl(crawlConfig: typeof CrawlConfig, resumeFromSaved: boolean = true) {
  try {
    // Hoán đổi nếu người dùng nhập ngược minPage/maxPage
    if (crawlConfig.pagination.minPage > crawlConfig.pagination.maxPage) {
      [crawlConfig.pagination.minPage, crawlConfig.pagination.maxPage] = [
        crawlConfig.pagination.maxPage,
        crawlConfig.pagination.minPage,
      ];
      logProgress(`⚠️ minPage > maxPage, tự hoán đổi: ${crawlConfig.pagination.minPage} → ${crawlConfig.pagination.maxPage}`);
    }

    const configHash = generateConfigHash(crawlConfig);

    // Check for resumable session
    let startPage = crawlConfig.pagination.minPage;
    if (resumeFromSaved) {
      const savedSession = await getResumableSession(configHash);
      if (savedSession && savedSession.currentPage < crawlConfig.pagination.maxPage) {
        logProgress(`⏳ Tìm thấy session đã lưu từ trang ${savedSession.currentPage}`);
        notifyUI(`Tìm thấy session đã lưu từ trang ${savedSession.currentPage}. Tiếp tục crawl?`);
        startPage = savedSession.currentPage;
        sessionState.collectedLinks = savedSession.collectedLinks;
        sessionState.savedRecords = savedSession.savedRecords;
        logProgress(`📍 Khôi phục tiến độ: ${sessionState.collectedLinks} links, ${sessionState.savedRecords} records`);
      }
    }

    sessionState.isRunning = true;
    sessionState.isPaused = false;
    sessionState.currentPage = startPage;
    sessionState.totalPages = crawlConfig.pagination.maxPage;

    logProgress("🚀 Bắt đầu crawl");
    notifyUI("Đang chuẩn bị...");
    await warmupSession(crawlConfig);

    let detailBatch: CrawlItem[] = [];
    let totalItemsProcessed = 0;

    // Loop through each page
    for (
      let page = startPage;
      page <= crawlConfig.pagination.maxPage;
      page++
    ) {
      if (!sessionState.isRunning) {
        logProgress("⏹️ Crawl bị dừng");
        // Save state before stopping
        await saveCrawlSession({
          timestamp: Date.now(),
          currentPage: page,
          totalPages: crawlConfig.pagination.maxPage,
          collectedLinks: sessionState.collectedLinks,
          savedRecords: sessionState.savedRecords,
          configHash,
          status: "stopped",
        });
        break;
      }

      await waitIfPaused();

      try {
        sessionState.currentPage = page;
        notifyUI(`Đang crawl danh sách trang ${page}/${crawlConfig.pagination.maxPage}`);

        // Create or update tab for collecting links
        if (currentTabId === null) {
          const tab = await chrome.tabs.create({
            url: buildPageUrl(crawlConfig.url.baseUrl, page),
            active: false,
          });
          currentTabId = tab.id ?? null;
        } else {
          await chrome.tabs.update(currentTabId, {
            url: buildPageUrl(crawlConfig.url.baseUrl, page),
          });
        }

        if (currentTabId === null) {
          throw new Error("Không tạo được tab");
        }

        // Wait for page to load
        await waitForTabComplete(currentTabId, crawlConfig.delay.pageLoadTimeout);
        await keepAliveSleep(Math.round(randomDelay() * crawlConfig.delay.delayMultiplier * throttle.slowdownFactor));
        await waitIfPaused();

        // Browse random links before collecting (anti-bot)
        await randomExploration(buildPageUrl(crawlConfig.url.baseUrl, page), crawlConfig);

        // Collect links from this page
        const collectResult = await collectLinksFromPage(currentTabId, crawlConfig);

        // Bị chặn khi thu thập link: hạ nhiệt rồi thử lại CHÍNH trang này
        // (thay vì bỏ qua và tiếp tục nã request trong khi đang bị gắn cờ).
        if (collectResult.captcha) {
          await handleCaptchaCooldown(crawlConfig, `trang ${page}`);
          page--; // for-loop sẽ page++ → quay lại đúng trang hiện tại
          continue;
        }

        throttle.registerSuccess(); // thu thập thành công → hồi phục tốc độ dần
        const pageLinks = collectResult.data;
        if (pageLinks.length > 0) {
          sessionState.collectedLinks += pageLinks.length;
          logProgress(`📄 Trang ${page}: ${pageLinks.length} links (tổng: ${sessionState.collectedLinks})`);

          // Process each link from this page to get detail data
          for (let i = 0; i < pageLinks.length; i++) {
            if (!sessionState.isRunning) {
              logProgress("⏹️ Crawl bị dừng");
              // Save state before stopping
              await saveCrawlSession({
                timestamp: Date.now(),
                currentPage: page,
                totalPages: crawlConfig.pagination.maxPage,
                collectedLinks: sessionState.collectedLinks,
                savedRecords: sessionState.savedRecords,
                configHash,
                status: "stopped",
              });
              break;
            }

            const item = pageLinks[i];
            totalItemsProcessed++;
            const progress = Math.round((totalItemsProcessed / sessionState.collectedLinks) * 100);
            notifyUI(`[Trang ${page}] Lấy chi tiết ${i + 1}/${pageLinks.length} (${progress}%)\n${item.link}`);

            // Đánh dấu giai đoạn đang chạy để khi lỗi biết chính xác bước nào hỏng
            let stage = "bắt đầu";
            try {
              // Retry logic for missing critical fields
              const MAX_RETRIES = 2;
              let detail: DetailData | null = null;
              let attempt = 0;

              while (attempt <= MAX_RETRIES && !hasRequiredFields(detail)) {
                // Open detail page
                if (currentTabId === null) {
                  stage = `mở tab chi tiết (lần ${attempt + 1})`;
                  logProgress(`🔹 [item ${i + 1}] ${stage}: ${item.link}`);
                  const tab = await chrome.tabs.create({
                    url: item.link,
                    active: false,
                  });
                  currentTabId = tab.id ?? null;
                } else {
                  stage = `điều hướng tab tới chi tiết (lần ${attempt + 1})`;
                  logProgress(`🔹 [item ${i + 1}] ${stage}: ${item.link}`);
                  await chrome.tabs.update(currentTabId, {
                    url: item.link,
                  });
                }

                if (currentTabId === null) {
                  throw new Error("Không tạo được tab chi tiết");
                }

                // Wait for page to load
                stage = "chờ trang load xong (waitForTabComplete)";
                await waitForTabComplete(currentTabId, crawlConfig.delay.pageLoadTimeout);
                stage = "delay chống bot sau khi load";
                await keepAliveSleep(Math.round(randomDelay() * crawlConfig.delay.delayMultiplier * throttle.slowdownFactor));
                await waitIfPaused();

                // Fetch detail
                stage = "trích xuất chi tiết (fetchDetailData)";
                logProgress(`🔹 [item ${i + 1}] ${stage}`);
                const fetchResult = await fetchDetailData(currentTabId, crawlConfig);
                detail = fetchResult.data;

                if (!hasRequiredFields(detail)) {
                  attempt++;
                  if (fetchResult.captcha) {
                    // Bị challenge thật: dùng cooldown lũy thừa + đổi phiên nếu lặp lại.
                    // currentTabId có thể bị null sau khi đổi phiên → vòng while sẽ mở lại tab.
                    await handleCaptchaCooldown(crawlConfig, `chi tiết ${item.link}`);
                  } else if (attempt <= MAX_RETRIES) {
                    const waitMs = Math.round(crawlConfig.delay.captchaWaitTime * throttle.slowdownFactor);
                    logProgress(`🔄 Retry ${attempt}/${MAX_RETRIES} cho ${item.link}, đợi ${Math.round(waitMs / 1000)}s...`);
                    await keepAliveSleep(waitMs);
                  }
                }
              }

              if (detail && hasRequiredFields(detail)) {
                throttle.registerSuccess(); // lấy chi tiết thành công → hồi phục tốc độ dần
                const crawlItem: CrawlItem = {
                  law_id: item.lawId || "",
                  name: item.name,
                  so_hieu: detail.so_hieu,
                  loai_van_ban: detail.loai_van_ban,
                  ngay_ban_hanh: detail.ngay_ban_hanh,
                  ngay_co_hieu_luc: detail.ngay_hieu_luc,
                  ngay_cap_nhat: item.cap_nhat,
                  noi_ban_hanh: detail.noi_ban_hanh,
                  tinh_trang_hieu_luc: item.tinh_trang,
                  content: detail.content,
                  source_url: detail.source_url,
                  luoc_do_html: detail.luoc_do_html,
                  luoc_do_links: detail.luoc_do_links,
                  vanbanBiBaiBo: detail.vanbanBiBaiBo,
                  vanbanBaiBo: detail.vanbanBaiBo,
                  vanbanSuaDoi: detail.vanbanSuaDoi,
                  vanbanBiSuaDoi: detail.vanbanBiSuaDoi,
                  vanbanDuocHuongDan: detail.vanbanDuocHuongDan,
                  vanbanHuongDan: detail.vanbanHuongDan,
                  vanbanBiDinhChinh: detail.vanbanBiDinhChinh,
                  vanbanDinhChinh: detail.vanbanDinhChinh,
                  vanbanDuocHopNhat: detail.vanbanDuocHopNhat,
                  vanbanHopNhat: detail.vanbanHopNhat,
                };

                detailBatch.push(crawlItem);

                // Send batch if reached batch size
                if (detailBatch.length >= crawlConfig.batch.batchSize) {
                  stage = "gửi batch API (saveAndSendBatch)";
                  const success = await saveAndSendBatch(detailBatch, crawlConfig);
                  if (!success) {
                    logProgress("⚠️ Batch gửi thất bại, dừng crawl");
                    throw new Error("Batch API failed");
                  }
                  detailBatch = [];
                }
              } else {
                logProgress(
                  `⚠️ Bỏ qua ${item.link} - Không lấy được số hiệu/loại VB sau ${MAX_RETRIES} lần thử`
                );
              }
            } catch (error) {
              // In rõ giai đoạn hỏng + message + stack (logProgress chỉ đẩy chuỗi vào log UI,
              // nên phải nhồi nội dung lỗi vào message thì UI mới thấy được)
              const errMsg = error instanceof Error ? error.message : String(error);
              const errStack = error instanceof Error && error.stack ? error.stack : "";
              logProgress(
                `❌ Lỗi chi tiết item ${i + 1} tại giai đoạn "${stage}" (${item.link}): ${errMsg}`,
                errStack || error
              );
            }
          }

          logProgress(`✅ Hoàn tất trang ${page}`);
          await maybeTakeSessionBreak();
        }
      } catch (error) {
        const isTabGone = error instanceof Error && error.message.includes("No tab with id");
        if (isTabGone) {
          const waitMs = crawlConfig.delay.captchaWaitTime;
          logProgress(`🛡️ Tab bị đóng (captcha?). Đợi ${waitMs / 1000}s rồi thử lại trang ${page}...`);
          notifyUI(`🛡️ Tab bị đóng! Vui lòng giải captcha, đợi ${waitMs / 1000}s...`);
          currentTabId = null;
          await keepAliveSleep(waitMs);
          page--; // retry lại trang hiện tại
        } else {
          logProgress(`❌ Lỗi trang ${page}:`, error);
        }
      }
    }

    // Send remaining items
    if (detailBatch.length > 0) {
      await saveAndSendBatch(detailBatch, crawlConfig);
    }

    // Cleanup
    if (currentTabId !== null) {
      chrome.tabs.remove(currentTabId).catch(() => {});
      currentTabId = null;
    }

    sessionState.isRunning = false;
    
    // Clear saved session on successful completion
    await clearCrawlSession();
    
    notifyUI(
      `✅ Hoàn tất!\nTổng links: ${sessionState.collectedLinks}\nLưu: ${sessionState.savedRecords} records`
    );

    logProgress("🎉 Crawl thành công!", sessionState);
  } catch (error) {
    sessionState.isRunning = false;
    const errorMessage = (error as Error).message;
    logProgress("❌ Crawl error:", error);
    notifyUI(`❌ Lỗi: ${errorMessage}`);

    // Save state on error for later resume
    const configHash = generateConfigHash(crawlConfig);
    await saveCrawlSession({
      timestamp: Date.now(),
      currentPage: sessionState.currentPage,
      totalPages: crawlConfig.pagination.maxPage,
      collectedLinks: sessionState.collectedLinks,
      savedRecords: sessionState.savedRecords,
      configHash,
      status: "error",
      errorMessage,
    });
    
    logProgress("💾 Đã lưu tiến độ để tiếp tục lần sau");
  }
}

// ==== Message listener ====
chrome.runtime.onMessage.addListener((msg: MessagePayload, sender, sendResponse) => {
  if (msg.type === "START") {
    try {
      // Chặn chạy nhiều vòng crawl đồng thời: hai loop cùng điều hướng một tab sẽ
      // đua nhau → "message channel closed" → báo bị chặn oan.
      if (sessionState.isRunning) {
        logProgress("⚠️ Bỏ qua START: đang có một phiên crawl chạy");
        sendResponse({ success: false, error: "Đang chạy rồi" });
        return true;
      }
      // Đặt cờ đồng bộ ngay đây để START thứ hai (trước khi startCrawl kịp set cờ
      // qua await đầu tiên) bị guard ở trên chặn lại.
      sessionState.isRunning = true;
      const config = msg.config || CrawlConfig;
      const resumeFromSaved = msg.resumeFromSaved !== false; // Default to true
      startCrawl(config, resumeFromSaved);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: (error as Error).message });
    }
    return true;
  }

  if (msg.type === "PAUSE") {
    sessionState.isPaused = true;
    logProgress("⏸️ Crawl bị tạm dừng");
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "RESUME") {
    sessionState.isPaused = false;
    logProgress("▶️ Tiếp tục crawl");
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "STOP") {
    sessionState.isRunning = false;
    logProgress("⏹️ Dừng crawl");
    if (currentTabId !== null) {
      chrome.tabs.remove(currentTabId).catch(() => {});
      currentTabId = null;
    }
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "GET_STATUS") {
    sendResponse({ type: "STATUS", statusText: lastStatusText, logs: [...recentLogs], ...sessionState });
    return true;
  }

  return true;
});

logProgress("🔧 Background script initialized");
