import { sleep, randomDelay } from "../utils/sleep";
import { saveCrawlDataToApi, CrawlItem, logCrawlItem } from "../utils/api-helper";
import { CrawlConfig } from "../config/default-config";

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

// ==== Helper functions ====
function logProgress(message: string, data?: any) {
  const timestamp = new Date().toLocaleTimeString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
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
  chrome.runtime.sendMessage({
    type: "STATUS",
    statusText,
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

// ==== Crawling functions ====
async function collectLinksFromPage(
  tabId: number,
  config: typeof CrawlConfig
): Promise<LinkItem[]> {
  try {
    logProgress(`📋 Gửi yêu cầu COLLECT tới tab ${tabId}`);

    const data = (await chrome.tabs.sendMessage(tabId, {
      type: "COLLECT",
      config,
    })) as CollectResult;

    if (!data) {
      logProgress("⚠️ Không nhận được dữ liệu từ COLLECT");
      return [];
    }

    if (data.captcha) {
      logProgress("⚠️ Phát hiện captcha trên trang");
      return [];
    }

    logProgress(`✅ Nhận được ${data.data.length} links`);
    return data.data;
  } catch (error) {
    logProgress("❌ Lỗi COLLECT:", error);
    return [];
  }
}

async function fetchDetailData(
  tabId: number,
  config: typeof CrawlConfig
): Promise<DetailData | null> {
  try {
    const detail = (await chrome.tabs.sendMessage(tabId, {
      type: "DETAIL",
      config,
    })) as DetailData | null;

    if (!detail) {
      logProgress("⚠️ Không nhận được dữ liệu chi tiết");
      return null;
    }

    return detail;
  } catch (error) {
    logProgress("❌ Lỗi DETAIL:", error);
    return null;
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
async function startCrawl(crawlConfig: typeof CrawlConfig) {
  try {
    sessionState.isRunning = true;
    sessionState.isPaused = false;
    sessionState.currentPage = crawlConfig.pagination.minPage;
    sessionState.totalPages = crawlConfig.pagination.maxPage;
    sessionState.collectedLinks = 0;
    sessionState.savedRecords = 0;

    logProgress("🚀 Bắt đầu crawl");
    notifyUI("Đang chuẩn bị...");

    // Phase 1: Collect links
    logProgress("📋 Phase 1: Tập hợp danh sách links", {
      minPage: crawlConfig.pagination.minPage,
      maxPage: crawlConfig.pagination.maxPage,
    });

    const allLinks: LinkItem[] = [];

    for (
      let page = crawlConfig.pagination.minPage;
      page <= crawlConfig.pagination.maxPage;
      page++
    ) {
      if (!sessionState.isRunning) {
        logProgress("⏹️ Crawl bị dừng");
        break;
      }

      try {
        sessionState.currentPage = page;
        notifyUI(`Đang crawl danh sách trang ${page}/${crawlConfig.pagination.maxPage}`);

        // Create or update tab
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
        await sleep(Math.round(randomDelay() * crawlConfig.delay.delayMultiplier));

        // Collect links
        const links = await collectLinksFromPage(currentTabId, crawlConfig);
        if (links.length > 0) {
          allLinks.push(...links);
          sessionState.collectedLinks += links.length;
          logProgress(`📄 Trang ${page}: ${links.length} links (tổng: ${sessionState.collectedLinks})`);
        }
      } catch (error) {
        logProgress(`❌ Lỗi trang ${page}:`, error);
      }
    }

    logProgress(`✅ Phase 1 hoàn tất. Tổng links: ${allLinks.length}`);

    // Phase 2: Extract detail and save by batch
    logProgress("📄 Phase 2: Lấy chi tiết và lưu dữ liệu", {
      totalLinks: allLinks.length,
      batchSize: crawlConfig.batch.batchSize,
    });

    let detailBatch: CrawlItem[] = [];

    for (let i = 0; i < allLinks.length; i++) {
      if (!sessionState.isRunning) {
        logProgress("⏹️ Crawl bị dừng");
        break;
      }

      const item = allLinks[i];
      const progress = Math.round(((i + 1) / allLinks.length) * 100);
      notifyUI(`Lấy chi tiết ${i + 1}/${allLinks.length} (${progress}%)\n${item.link}`);

      try {
        // Retry logic for missing critical fields
        const MAX_RETRIES = 2;
        let detail: DetailData | null = null;
        let attempt = 0;

        while (attempt <= MAX_RETRIES && !hasRequiredFields(detail)) {
          // Open detail page
          if (currentTabId === null) {
            const tab = await chrome.tabs.create({
              url: item.link,
              active: false,
            });
            currentTabId = tab.id ?? null;
          } else {
            await chrome.tabs.update(currentTabId, {
              url: item.link,
            });
          }

          if (currentTabId === null) {
            throw new Error("Không tạo được tab chi tiết");
          }

          // Wait for page to load
          await waitForTabComplete(currentTabId, crawlConfig.delay.pageLoadTimeout);
          await sleep(Math.round(randomDelay() * crawlConfig.delay.delayMultiplier));

          // Fetch detail
          detail = await fetchDetailData(currentTabId, crawlConfig);

          if (!hasRequiredFields(detail)) {
            attempt++;
            if (attempt <= MAX_RETRIES) {
              logProgress(
                `🔄 Retry ${attempt}/${MAX_RETRIES} cho ${item.link} - Thiếu số hiệu hoặc loại VB`
              );
              // Wait before retry
              await sleep(2000);
            }
          }
        }

        if (detail && hasRequiredFields(detail)) {
          const crawlItem: CrawlItem = {
            law_id: item.lawId || "",
            name: item.name,
            so_hieu: detail.so_hieu,
            loai_van_ban: detail.loai_van_ban,
            ngay_ban_hanh: detail.ngay_ban_hanh,
            ngay_co_hieu_luc: detail.ngay_hieu_luc,
            ngay_cap_nhat: item.cap_nhat,
            noi_ban_hanh: detail.noi_ban_hanh,
            tinh_trang_hieu_luc: detail.tinh_trang_hieu_luc,
            content: detail.content,
            source_url: detail.source_url,
          };

          detailBatch.push(crawlItem);

          // Send batch if reached batch size
          if (detailBatch.length >= crawlConfig.batch.batchSize) {
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
        logProgress(`❌ Lỗi chi tiết item ${i + 1}:`, error);
      }
    }

    // Send remaining items
    if (detailBatch.length > 0) {
      await saveAndSendBatch(detailBatch, crawlConfig);
    }

    logProgress("✅ Phase 2 hoàn tất");

    // Cleanup
    if (currentTabId !== null) {
      chrome.tabs.remove(currentTabId).catch(() => {});
      currentTabId = null;
    }

    sessionState.isRunning = false;
    notifyUI(
      `✅ Hoàn tất!\nTổng links: ${sessionState.collectedLinks}\nLưu: ${sessionState.savedRecords} records`
    );

    logProgress("🎉 Crawl thành công!", sessionState);
  } catch (error) {
    sessionState.isRunning = false;
    logProgress("❌ Crawl error:", error);
    notifyUI(`❌ Lỗi: ${(error as Error).message}`);
  }
}

// ==== Message listener ====
chrome.runtime.onMessage.addListener((msg: MessagePayload, sender, sendResponse) => {
  if (msg.type === "START") {
    try {
      const config = msg.config || CrawlConfig;
      startCrawl(config);
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

  return true;
});

logProgress("🔧 Background script initialized");
