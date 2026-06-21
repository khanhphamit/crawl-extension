import { extractText, extractHtml, waitForPageLoad } from "../utils/dom-helper";
import { sleep } from "../utils/sleep";
import { CrawlConfig } from "../config/default-config";
import { isCaptchaByText } from "../utils/anti-detection";

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

// reCAPTCHA "I'm not a robot" checkbox (anchor) HIỂN THỊ = đang thực sự thử thách.
// CỰC QUAN TRỌNG: thuvienphapluat.vn nhúng sẵn reCAPTCHA vô hình (cho login) trên
// MỌI trang — ở trạng thái nghỉ anchor là 0x0/ẩn, .g-recaptcha và [data-sitekey]
// cũng 0x0/ẩn. Nếu coi sự HIỆN DIỆN của widget là captcha thì sẽ báo nhầm mọi
// trang tải tốt → extension cooldown vô tận. Chỉ tính khi challenge thật sự bày ra.
function isVisible(el: Element | null): el is HTMLElement {
  const h = el as HTMLElement | null;
  return !!h && h.offsetParent !== null && h.offsetWidth > 50 && h.offsetHeight > 50;
}

function hasVisibleChallengeWidget(): boolean {
  // Checkbox reCAPTCHA đang hiện
  if (isVisible(document.querySelector('iframe[src*="recaptcha/api2/anchor"]'))) return true;
  // Cloudflare Turnstile đang hiện
  if (isVisible(document.querySelector('iframe[src*="challenges.cloudflare.com"]'))) return true;
  // hCaptcha checkbox đang hiện
  if (isVisible(document.querySelector('iframe[src*="hcaptcha.com"][src*="frame=checkbox"]'))) return true;
  // Captcha ảnh tự host đang hiện
  if (isVisible(document.querySelector('#captcha, #captchaImg, img[src*="captcha" i]'))) return true;
  return false;
}

function isCaptcha(): boolean {
  // 1) Trang chặn Cloudflare interstitial theo tiêu đề (bản địa hoá) / từ khoá — tin cậy nhất
  if (isCaptchaByText(document.title, document.body?.innerText || "")) {
    return true;
  }

  // 2) Container challenge Cloudflare kiểu cũ
  if (document.querySelector('#challenge-running, #challenge-form, #cf-challenge-running')) {
    return true;
  }

  // 3) reCAPTCHA/Turnstile/hCaptcha ĐANG hiển thị thử thách (không tính widget nghỉ)
  return hasVisibleChallengeWidget();
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

// Lấy text của 1 selector TRONG phạm vi 1 phần tử (không phải toàn document).
// QUAN TRỌNG: dùng extractText (document.querySelector) ở đây sẽ luôn trả về cột
// của item ĐẦU TIÊN trên trang → mọi văn bản bị gán nhầm ngày/tình trạng giống nhau.
function extractTextWithin(root: Element, selector: string): string {
  try {
    return (root.querySelector(selector)?.textContent || "").trim();
  } catch (e) {
    console.error("[Scraper] Lỗi extractTextWithin:", selector, e);
    return "";
  }
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanPause(min: number = 400, max: number = 1200): Promise<void> {
  await sleep(randomBetween(min, max));
}

// Scroll giống người đọc thật, nhưng GIỚI HẠN số bước + thời gian.
// QUAN TRỌNG: dùng số bước CỐ ĐỊNH (không phải bước px nhỏ theo chiều dài trang),
// nếu không văn bản pháp luật rất dài sẽ khiến cuộn lặp hàng trăm vòng → kẹt
// "scroll đi scroll lại" nhiều phút trên một trang.
async function humanScroll(): Promise<void> {
  const totalHeight = document.documentElement.scrollHeight;
  const viewHeight = window.innerHeight;
  if (totalHeight <= viewHeight) {
    await humanPause(300, 800);
    return;
  }

  const target = totalHeight * (randomBetween(30, 70) / 100);
  const start = window.scrollY;
  const distance = Math.max(1, target - start);
  const steps = randomBetween(8, 16); // số bước cố định, không theo chiều dài trang
  const baseStep = distance / steps;
  const deadline = Date.now() + 9000; // ngân sách tối đa 9s cho 1 lần cuộn

  let current = start;
  for (let i = 0; i < steps && Date.now() < deadline; i++) {
    // Bước có nhiễu ±30% để không đều như máy
    current = Math.min(current + baseStep * (0.7 + Math.random() * 0.6), target);
    window.scrollTo({ top: current, behavior: "smooth" });
    await humanPause(120, 350);

    // 20% dừng đọc ngắn (giảm xác suất + thời lượng để không kéo dài)
    if (Math.random() < 0.2) {
      await humanPause(600, 1500);
    }

    // 12% lướt ngược lên một chút rồi tiếp (như mắt người đọc lại)
    if (Math.random() < 0.12) {
      window.scrollTo({ top: Math.max(0, current - randomBetween(40, 120)), behavior: "smooth" });
      await humanPause(250, 600);
      window.scrollTo({ top: current, behavior: "smooth" });
      await humanPause(150, 350);
    }
  }

  // 30% dừng đọc lâu hơn một chút trước khi về đầu
  if (Math.random() < 0.3) {
    await humanPause(800, 2000);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  await humanPause(300, 700);
}

// Tính điểm trên đường cong bezier bậc 2
function bezierPoint(t: number, p0: number, p1: number, p2: number): number {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

// Di chuyển chuột mượt từ điểm A → B theo đường cong có nhiễu nhỏ
async function smoothMouseMove(
  fromX: number, fromY: number,
  toX: number, toY: number,
  steps: number = 25
): Promise<void> {
  // Control point lệch để tạo đường cong tự nhiên (không thẳng)
  const cpX = (fromX + toX) / 2 + randomBetween(-120, 120);
  const cpY = (fromY + toY) / 2 + randomBetween(-120, 120);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Ease in-out: chậm ở đầu/cuối, nhanh ở giữa
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const x = Math.round(bezierPoint(eased, fromX, cpX, toX));
    const y = Math.round(bezierPoint(eased, fromY, cpY, toY));

    // Nhiễu nhỏ ±2px — tay người không bao giờ hoàn toàn thẳng
    const nx = Math.max(0, Math.min(x + Math.round((Math.random() - 0.5) * 4), window.innerWidth));
    const ny = Math.max(0, Math.min(y + Math.round((Math.random() - 0.5) * 4), window.innerHeight));

    document.dispatchEvent(new MouseEvent("mousemove", {
      bubbles: true, cancelable: true,
      clientX: nx, clientY: ny,
      movementX: nx - (i > 0 ? nx : fromX),
      movementY: ny - (i > 0 ? ny : fromY),
    }));

    // Delay thay đổi: chậm đầu/cuối, nhanh giữa (giống gia tốc thật)
    const speedFactor = Math.sin(t * Math.PI); // 0→1→0
    await sleep(Math.round((1 - speedFactor * 0.7) * randomBetween(8, 22)));
  }
}

// Tạo đường di chuyển chuột tự nhiên qua 2-4 điểm ngẫu nhiên
async function naturalMousePath(): Promise<void> {
  let x = randomBetween(80, window.innerWidth - 80);
  let y = randomBetween(80, window.innerHeight - 80);

  const waypoints = randomBetween(2, 4);
  for (let i = 0; i < waypoints; i++) {
    const tx = randomBetween(80, window.innerWidth - 80);
    const ty = randomBetween(80, window.innerHeight - 80);
    const steps = randomBetween(18, 35);

    await smoothMouseMove(x, y, tx, ty, steps);
    await humanPause(80, 350);

    // Đôi khi dừng lại như đang đọc nội dung
    if (Math.random() < 0.2) {
      await humanPause(500, 1500);
    }

    x = tx;
    y = ty;
  }
}

// Giữ lại idleMouseMovement nhưng dùng naturalMousePath bên trong
async function idleMouseMovement(count: number = 3): Promise<void> {
  for (let i = 0; i < count; i++) {
    await naturalMousePath();
    await humanPause(80, 250);
  }
}

// Cuộn bằng bàn phím — Cloudflare detect thiếu keyboard events
async function keyboardScroll(): Promise<void> {
  const scrollKeys = ["ArrowDown", "ArrowDown", "ArrowDown", "PageDown", "ArrowUp"];
  const count = randomBetween(3, 7);
  for (let i = 0; i < count; i++) {
    const key = scrollKeys[Math.floor(Math.random() * (i < count - 1 ? 3 : 5))];
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    await humanPause(60, 180);
    document.body.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
    await humanPause(40, 120);
  }
}

// Select text ngẫu nhiên như người đang đọc
async function simulateTextSelection(): Promise<void> {
  const candidates = Array.from(
    document.querySelectorAll("p, h2, h3, li, td")
  ).filter((el) => (el.textContent || "").trim().length > 20);

  if (candidates.length === 0) return;

  const el = candidates[Math.floor(Math.random() * Math.min(candidates.length, 6))];
  const textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

  const text = textNode.textContent || "";
  try {
    const start = Math.floor(Math.random() * (text.length / 2));
    const end = Math.min(start + randomBetween(5, 25), text.length);
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    await humanPause(400, 1100);
    window.getSelection()?.removeAllRanges();
  } catch {
    // ignore
  }
}

// Blur/focus — giả lập chuyển tab rồi quay lại
async function simulateTabActivity(): Promise<void> {
  if (Math.random() > 0.25) return; // 25% xác suất
  window.dispatchEvent(new Event("blur"));
  document.dispatchEvent(new Event("visibilitychange"));
  await humanPause(800, 3000);
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await humanPause(200, 500);
}

// Right-click ngẫu nhiên — người thật hay làm thế
async function randomContextMenu(): Promise<void> {
  if (Math.random() > 0.2) return; // 20% xác suất
  const x = randomBetween(150, window.innerWidth - 150);
  const y = randomBetween(150, window.innerHeight - 150);
  document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  await humanPause(300, 700);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await humanPause(100, 200);
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
  await simulateTabActivity();
  await idleMouseMovement(randomBetween(2, 4));
  await keyboardScroll();
  await humanScroll();
  await simulateTextSelection();
  await randomContextMenu();

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
        ban_hanh: extractDate(extractTextWithin(item, ".right-col p:nth-child(1)")),
        hieu_luc: extractDate(extractTextWithin(item, ".right-col p:nth-child(2)")),
        tinh_trang: parseTableCell(extractTextWithin(item, ".right-col p:nth-child(3)")),
        cap_nhat: extractDate(extractTextWithin(item, ".right-col p:nth-child(4)")),
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
    // Simulate human reading the page before extracting data
    await humanPause(600, 1800);
    await simulateTabActivity();
    await idleMouseMovement(randomBetween(3, 6));
    await keyboardScroll();
    await humanScroll();
    await simulateTextSelection();
    await randomContextMenu();

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
          if (isCaptcha()) {
            console.warn("[Scraper] Captcha detected on detail page");
            sendResponse({ __captcha: true });
            return;
          }

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

  if (msg.type === "GET_RANDOM_LINKS") {
    const domain = window.location.hostname;
    const all = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((href) => {
        try {
          const url = new URL(href);
          return url.hostname === domain && href !== window.location.href && !href.includes("#");
        } catch {
          return false;
        }
      });
    // Shuffle và trả về tối đa 8 link
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 8);
    sendResponse(shuffled);
    return true;
  }

  return true;
});

console.log("[Scraper] Content script initialized");
