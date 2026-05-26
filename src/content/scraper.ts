import { extractText, extractHtml, waitForPageLoad } from "../utils/dom-helper";
import { CrawlConfig } from "../config/default-config";

export type LinkItem = {
  link: string;
  lawId: string | null;
  name: string;
  ban_hanh: string;
  hieu_luc: string;
  tinh_trang: string;
  cap_nhat: string;
};

export type DetailData = {
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

export type CollectResponse = {
  captcha: boolean;
  data: LinkItem[];
};

function isCaptcha(): boolean {
  const text = document.body.innerText.toLowerCase();
  return (
    text.includes("captcha") ||
    text.includes("mã xác minh") ||
    text.includes("xác thực")
  );
}

function extractDate(text: string): string {
  if (!text) return "";
  const match = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
  return match ? match[0] : text.trim();
}

function parseTableCell(text: string, index: number = 1): string {
  const parts = text.split(":");
  if (parts.length > index) {
    return parts[index].trim();
  }
  return text.trim();
}

function collectLinksFromPage(config: typeof CrawlConfig): LinkItem[] {
  const items = document.querySelectorAll(config.listPageSelectors.itemContainer);
  const results: LinkItem[] = [];

  items.forEach((item) => {
    try {
      const linkEl = item.querySelector(config.listPageSelectors.linkSelector) as HTMLAnchorElement | null;
      // const pEl = item.querySelector(config.listPageSelectors.nameSelector);
      const lawIdEl = item.querySelector(config.listPageSelectors.lawIdSelector);
      const lawId = lawIdEl?.getAttribute(config.listPageSelectors.lawIdAttribute) || null;

      results.push({
        link: linkEl?.href || "",
        lawId,
        name: linkEl?.innerText || "",
        ban_hanh: extractDate(extractText(".right-col p:nth-child(1)")),
        hieu_luc: extractDate(extractText(".right-col p:nth-child(2)")),
        tinh_trang: parseTableCell(extractText(".right-col p:nth-child(3)")),
        cap_nhat: extractDate(extractText(".right-col p:nth-child(4)")),
      });
    } catch (e) {
      console.error("[Scraper] Error collecting link:", e);
    }
  });

  return results;
}

function extractDetailData(config: typeof CrawlConfig): DetailData | null {
  try {
    return {
      so_hieu: extractText(config.detailPageSelectors.soHieuSelector),
      loai_van_ban: extractText(config.detailPageSelectors.loaiVanBanSelector),
      noi_ban_hanh: extractText(config.detailPageSelectors.noibanHanhSelector),
      ngay_ban_hanh: extractDate(extractText(config.detailPageSelectors.ngayBanHanhSelector)),
      ngay_hieu_luc: extractDate(extractText(config.detailPageSelectors.ngayHieuLucSelector)),
      ngay_cap_nhat: extractDate(extractText(config.detailPageSelectors.ngayCapNhatSelector)),
      tinh_trang_hieu_luc: extractText(config.detailPageSelectors.tinhTrangSelector),
      content: extractHtml(config.detailPageSelectors.contentSelector),
      source_url: window.location.href,
    };
  } catch (error) {
    console.error("[Scraper] Error extracting detail:", error);
    return null;
  }
}

// Message listener
chrome.runtime.onMessage.addListener((msg: { type: string; config?: typeof CrawlConfig }, sender, sendResponse) => {
  if (msg.type === "COLLECT") {
    try {
      waitForPageLoad().then(() => {
        const captcha = isCaptcha();

        if (captcha) {
          console.warn("[Scraper] Captcha detected");
          sendResponse({ captcha: true, data: [] });
          return;
        }

        const links = collectLinksFromPage(msg.config || CrawlConfig);
        console.log(`[Scraper] Collected ${links.length} links`);

        sendResponse({
          captcha: false,
          data: links,
        });
      });
    } catch (error) {
      console.error("[Scraper] Error in COLLECT:", error);
      sendResponse({ captcha: false, data: [] });
    }

    return true;
  }

  if (msg.type === "DETAIL") {
    try {
      waitForPageLoad().then(() => {
        const detail = extractDetailData(msg.config || CrawlConfig);

        if (detail) {
          console.log("[Scraper] Extracted detail:", detail.so_hieu);
        }

        sendResponse(detail);
      });
    } catch (error) {
      console.error("[Scraper] Error in DETAIL:", error);
      sendResponse(null);
    }

    return true;
  }

  return true;
});

console.log("[Scraper] Content script initialized");
