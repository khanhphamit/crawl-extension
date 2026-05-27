import { extractText, extractHtml, waitForPageLoad } from "../utils/dom-helper";
import { sleep } from "../utils/sleep";
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

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanPause(min: number = 400, max: number = 1200): Promise<void> {
  await sleep(randomBetween(min, max));
}

async function humanScroll(): Promise<void> {
  const steps = randomBetween(1, 3);
  for (let i = 0; i < steps; i += 1) {
    window.scrollBy({
      top: randomBetween(window.innerHeight / 4, window.innerHeight / 2),
      left: 0,
      behavior: "smooth",
    });
    await humanPause(250, 600);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  await humanPause(150, 350);
}

async function humanClick(element: HTMLElement | null): Promise<boolean> {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const x = Math.floor(rect.left + rect.width / 2);
  const y = Math.floor(rect.top + rect.height / 2);

  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await humanPause(200, 500);
  element.focus();
  element.dispatchEvent(
    new MouseEvent("mousemove", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    })
  );
  await humanPause(100, 250);
  element.dispatchEvent(
    new MouseEvent("mouseover", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    })
  );
  await humanPause(100, 250);
  element.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    })
  );
  await humanPause(80, 180);
  element.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    })
  );
  element.click();
  await humanPause(200, 400);
  return true;
}

async function collectLinksFromPage(config: typeof CrawlConfig): Promise<LinkItem[]> {
  await humanPause(500, 1200);
  await humanScroll();

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

async function extractLuocDoData(config: typeof CrawlConfig): Promise<{
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
}> {
  try {
    const luocDoCandidateSelectors = [
      config.detailPageSelectors.luocDoButtonSelector,
      "#aLuocDo",
      "#ctl00_Content_ThongTinVB_spLuocDo",
    ];

    let button: HTMLElement | null = null;
    for (const selector of luocDoCandidateSelectors) {
      if (!selector) continue;
      button = document.querySelector(selector) as HTMLElement | null;
      if (button) {
        break;
      }
    }

    if (!button) {
      button = (Array.from(document.querySelectorAll("a, span")) as HTMLElement[]).find((el) =>
        el.textContent?.trim() === "Lược đồ"
      ) || null;
    }

    if (!button) {
      console.warn("[Scraper] Không tìm thấy button lược đồ", config.detailPageSelectors.luocDoButtonSelector);
      return {
        luoc_do_html: "",
        luoc_do_links: [],
        vanbanBiBaiBo: [],
        vanbanBaiBo: [],
        vanbanSuaDoi: [],
        vanbanBiSuaDoi: [],
        vanbanDuocHuongDan: [],
        vanbanHuongDan: [],
        vanbanBiDinhChinh: [],
        vanbanDinhChinh: [],
        vanbanDuocHopNhat: [],
        vanbanHopNhat: [],
      };
    }

    const clickTarget =
      button.tagName.toLowerCase() === "a"
        ? (button.querySelector("span") as HTMLElement | null) ?? button
        : button;

    // Try multiple ways to trigger the tab change — simulate a real user click
    await humanScroll();
    await humanPause(300, 700);
    const clicked = await humanClick(clickTarget);
    if (!clicked) {
      clickTarget.click();
    }
    if (button !== clickTarget && button) {
      await humanPause(100, 200);
      button.click();
    }

    // wait like Python sleep after click so dynamic tab content has time to render
    await humanPause(1000, 2200);

    const startTime = Date.now();
    let luocDoContainer: Element | null = null;

    // extend wait to 15s and poll a bit slower to be more tolerant of slow loads
    while (Date.now() - startTime < 15000) {
      // prefer configured selector but fallback to common tab id used on the site
      luocDoContainer = document.querySelector(config.detailPageSelectors.luocDoContentSelector) || document.getElementById("tab4");
      if (luocDoContainer) {
        const hasLinks = luocDoContainer.querySelectorAll("a[href]").length > 0;
        const hasText = (luocDoContainer.textContent || "").trim().length > 0;
        const isVisible = (luocDoContainer as HTMLElement).offsetParent !== null;

        if (hasLinks || (hasText && isVisible)) {
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (!luocDoContainer) {
      console.warn("[Scraper] Không đợi được nội dung lược đồ", config.detailPageSelectors.luocDoContentSelector);
      return {
        luoc_do_html: "",
        luoc_do_links: [],
        vanbanBiBaiBo: [],
        vanbanBaiBo: [],
        vanbanSuaDoi: [],
        vanbanBiSuaDoi: [],
        vanbanDuocHuongDan: [],
        vanbanHuongDan: [],
        vanbanBiDinhChinh: [],
        vanbanDinhChinh: [],
        vanbanDuocHopNhat: [],
        vanbanHopNhat: [],
      };
    }

    const luocDoHtml = luocDoContainer.innerHTML;
    const luocDoLinks = Array.from(luocDoContainer.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href") || "")
      .filter((href) => href.length > 0);

    console.log(`[Scraper] Extracted luoc do with ${luocDoLinks.length} links`); 
    console.log(`[Scraper] Luoc do HTML length: ${luocDoHtml.length}`);

    const getLinksByDivId = (divId: string) => {
      const section = luocDoContainer?.querySelector(`#${divId}`);
      if (!section) return [];
      const result: string[] = [];
      const anchors = Array.from(section.querySelectorAll("a[href]")) as HTMLAnchorElement[];
      anchors.forEach((a) => {
        try {
          const href = a.getAttribute("href") || "";
          if (!href) return;
          const parts = href.split("-");
          const last = parts[parts.length - 1] || "";
          const id = last.split(".")[0] || "";
          if (id && id.length > 0) result.push(id);
        } catch (e) {
           console.error(`[Scraper] Error parsing link in ${divId}:`, e);
        }
      });
      return result;
    };

    return {
      luoc_do_html: luocDoHtml,
      luoc_do_links: luocDoLinks,
      vanbanBiBaiBo: getLinksByDivId("replacedDocument"),
      vanbanBaiBo: getLinksByDivId("replaceDocument"),
      vanbanSuaDoi: getLinksByDivId("amendDocument"),
      vanbanBiSuaDoi: getLinksByDivId("amendedDocument"),
      vanbanDuocHuongDan: getLinksByDivId("guidedDocument"),
      vanbanHuongDan: getLinksByDivId("guideDocument"),
      vanbanBiDinhChinh: getLinksByDivId("correctedDocument"),
      vanbanDinhChinh: getLinksByDivId("correctingDocument"),
      vanbanDuocHopNhat: getLinksByDivId("DuocHopNhatDocument"),
      vanbanHopNhat: getLinksByDivId("HopNhatDocument"),
    };
  } catch (error) {
    console.error("[Scraper] Error extracting luoc do:", error);
    return {
      luoc_do_html: "",
      luoc_do_links: [],
      vanbanBiBaiBo: [],
      vanbanBaiBo: [],
      vanbanSuaDoi: [],
      vanbanBiSuaDoi: [],
      vanbanDuocHuongDan: [],
      vanbanHuongDan: [],
      vanbanBiDinhChinh: [],
      vanbanDinhChinh: [],
      vanbanDuocHopNhat: [],
      vanbanHopNhat: [],
    };
  }
}

async function extractDetailData(config: typeof CrawlConfig): Promise<DetailData | null> {
  try {
    const luocDo = await extractLuocDoData(config);
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
      luoc_do_html: luocDo.luoc_do_html,
      luoc_do_links: luocDo.luoc_do_links,
      vanbanBiBaiBo: luocDo.vanbanBiBaiBo,
      vanbanBaiBo: luocDo.vanbanBaiBo,
      vanbanSuaDoi: luocDo.vanbanSuaDoi,
      vanbanBiSuaDoi: luocDo.vanbanBiSuaDoi,
      vanbanDuocHuongDan: luocDo.vanbanDuocHuongDan,
      vanbanHuongDan: luocDo.vanbanHuongDan,
      vanbanBiDinhChinh: luocDo.vanbanBiDinhChinh,
      vanbanDinhChinh: luocDo.vanbanDinhChinh,
      vanbanDuocHopNhat: luocDo.vanbanDuocHopNhat,
      vanbanHopNhat: luocDo.vanbanHopNhat,
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
      waitForPageLoad().then(async () => {
        const captcha = isCaptcha();

        if (captcha) {
          console.warn("[Scraper] Captcha detected");
          sendResponse({ captcha: true, data: [] });
          return;
        }

        const links = await collectLinksFromPage(msg.config || CrawlConfig);
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
      waitForPageLoad()
        .then(async () => {
          const detail = await extractDetailData(msg.config || CrawlConfig);

          if (detail) {
            console.log("[Scraper] Extracted detail:", detail.so_hieu);
          }

          sendResponse(detail);
        })
        .catch((error) => {
          console.error("[Scraper] Error in DETAIL after page load:", error);
          sendResponse(null);
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
