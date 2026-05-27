import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const CrawlConfig = {
  url: {
    baseUrl:
      "https://thuvienphapluat.vn/page/tim-van-ban.aspx?keyword=&area=0&type=0&status=0&lan=1&org=0&signer=0&match=True&sort=1&bdate=16/03/2025&edate=02/07/2025&page=",
  },
  pagination: {
    minPage: 1,
    maxPage: 1,
  },
  listPageSelectors: {
    itemContainer: "#block-info #block-info-advan .content-0, .content-1",
    linkSelector: "p.nqTitle a",
    lawIdSelector: "p.nqTitle",
    lawIdAttribute: "lawid",
    datePublishedSelector: ".right-col p:nth-child(1)",
    dateEffectiveSelector: ".right-col p:nth-child(2)",
    statusSelector: ".right-col p:nth-child(3)",
    lastUpdatedSelector: ".right-col p:nth-child(4)",
  },
  detailPageSelectors: {
    soHieuSelector: "#divThuocTinh table tr:nth-child(1) td:nth-child(2)",
    loaiVanBanSelector: "#divThuocTinh table tr:nth-child(1) td:nth-child(5)",
    noibanHanhSelector: "#divThuocTinh table tr:nth-child(2) td:nth-child(2)",
    ngayBanHanhSelector: "#divThuocTinh table tr:nth-child(3) td:nth-child(2)",
    ngayHieuLucSelector: "#divThuocTinh table tr:nth-child(3) td:nth-child(5)",
    ngayCapNhatSelector: "#divThuocTinh table tr:nth-child(4) td:nth-child(2)",
    tinhTrangSelector: "#divThuocTinh table tr:nth-child(5) td:nth-child(3)",
    contentSelector: ".content1",
    luocDoButtonSelector: "#aLuocDo",
    luocDoContentSelector: "#tab4",
  },
  delay: {
    minDelay: 500,
    maxDelay: 1600,
    pageLoadTimeout: 30000,
  },
};

const outputPath = path.resolve(process.env.OUTPUT_PATH || "playwright-output.json");
const baseUrl = process.env.BASE_URL || CrawlConfig.url.baseUrl;
const minPage = Number(process.env.MIN_PAGE || CrawlConfig.pagination.minPage);
const maxPage = Number(process.env.MAX_PAGE || CrawlConfig.pagination.maxPage);

function randomDelay(min = 500, max = 1500) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function humanPause(page, min = 300, max = 700) {
  await page.waitForTimeout(randomDelay(min, max));
}

async function humanScroll(page) {
  const height = await page.evaluate(() => document.body.scrollHeight || 0);
  const scrollY = Math.floor(Math.random() * Math.max(1, height));
  await page.mouse.wheel(0, scrollY);
  await humanPause(page, 200, 600);
}

async function humanClick(page, selector) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded();
  await humanPause(page, 250, 500);
  await locator.hover();
  await humanPause(page, 250, 500);
  await locator.click({ timeout: 15000 });
}

function formatUrl(pageNumber) {
  if (baseUrl.includes("page=")) {
    return baseUrl.replace(/page=[^&]*/, `page=${pageNumber}`);
  }
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}page=${pageNumber}`;
}

function extractLawIdFromHref(href) {
  if (!href) return "";
  const parts = href.split("-");
  const last = parts[parts.length - 1] || "";
  return last.split(".")[0] || "";
}

async function textOrEmpty(page, selector) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return "";
  return (await locator.innerText()).trim();
}

async function htmlOrEmpty(page, selector) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return "";
  return (await locator.innerHTML()).trim();
}

async function collectLinksFromPage(page, pageNumber) {
  const pageUrl = formatUrl(pageNumber);
  console.log(`➡️  Visiting list page ${pageNumber}: ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: CrawlConfig.delay.pageLoadTimeout });
  await page.waitForSelector(CrawlConfig.listPageSelectors.itemContainer, { timeout: CrawlConfig.delay.pageLoadTimeout });
  await humanScroll(page);
  await humanPause(page, 400, 900);

  const cards = page.locator(CrawlConfig.listPageSelectors.itemContainer);
  const count = await cards.count();
  const results = [];

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const linkLocator = card.locator(CrawlConfig.listPageSelectors.linkSelector).first();
    const href = (await linkLocator.getAttribute("href")) || "";
    const name = (await linkLocator.innerText()).trim();
    const lawId = (await card.locator(CrawlConfig.listPageSelectors.lawIdSelector).first().getAttribute(CrawlConfig.listPageSelectors.lawIdAttribute)) || null;
    const ban_hanh = (await card.locator(CrawlConfig.listPageSelectors.datePublishedSelector).first().innerText().catch(() => "")).trim();
    const hieu_luc = (await card.locator(CrawlConfig.listPageSelectors.dateEffectiveSelector).first().innerText().catch(() => "")).trim();
    const tinh_trang = (await card.locator(CrawlConfig.listPageSelectors.statusSelector).first().innerText().catch(() => "")).trim();
    const cap_nhat = (await card.locator(CrawlConfig.listPageSelectors.lastUpdatedSelector).first().innerText().catch(() => "")).trim();

    if (href) {
      results.push({
        link: href,
        lawId,
        name,
        ban_hanh,
        hieu_luc,
        tinh_trang,
        cap_nhat,
      });
    }
  }

  console.log(`✅ Collected ${results.length} links from page ${pageNumber}`);
  return results;
}

async function getLuocDoLinks(page, selector) {
  const contentSelector = CrawlConfig.detailPageSelectors.luocDoContentSelector;
  if (!contentSelector) return [];
  return page.$$eval(`${contentSelector} ${selector} a[href]`, (anchors) =>
    anchors
      .map((anchor) => {
        const href = anchor.getAttribute("href") || "";
        const parts = href.split("-");
        const last = parts[parts.length - 1] || "";
        return last.split(".")[0] || "";
      })
      .filter(Boolean)
  );
}

async function extractDetail(page, link) {
  console.log(`➡️  Open detail page: ${link}`);
  await page.goto(link, { waitUntil: "domcontentloaded", timeout: CrawlConfig.delay.pageLoadTimeout });
  await humanPause(page, 500, 1200);
  await humanScroll(page);

  const buttonSelector = CrawlConfig.detailPageSelectors.luocDoButtonSelector;
  if (buttonSelector) {
    const buttonLocator = page.locator(buttonSelector).first();
    if ((await buttonLocator.count()) > 0) {
      await humanClick(page, buttonSelector);
      await page.waitForTimeout(800);
    }
  }

  const contentSelector = CrawlConfig.detailPageSelectors.luocDoContentSelector || "#tab4";
  await page.waitForSelector(contentSelector, { timeout: CrawlConfig.delay.pageLoadTimeout });
  await humanPause(page, 500, 1000);

  const detail = {
    so_hieu: await textOrEmpty(page, CrawlConfig.detailPageSelectors.soHieuSelector),
    loai_van_ban: await textOrEmpty(page, CrawlConfig.detailPageSelectors.loaiVanBanSelector),
    noi_ban_hanh: await textOrEmpty(page, CrawlConfig.detailPageSelectors.noibanHanhSelector),
    ngay_ban_hanh: await textOrEmpty(page, CrawlConfig.detailPageSelectors.ngayBanHanhSelector),
    ngay_hieu_luc: await textOrEmpty(page, CrawlConfig.detailPageSelectors.ngayHieuLucSelector),
    ngay_cap_nhat: await textOrEmpty(page, CrawlConfig.detailPageSelectors.ngayCapNhatSelector),
    tinh_trang_hieu_luc: await textOrEmpty(page, CrawlConfig.detailPageSelectors.tinhTrangSelector),
    content: await htmlOrEmpty(page, CrawlConfig.detailPageSelectors.contentSelector),
    source_url: link,
    luoc_do_html: await htmlOrEmpty(page, contentSelector),
    luoc_do_links: await page.$$eval(`${contentSelector} a[href]`, (anchors) => anchors.map((a) => a.getAttribute("href") || "").filter(Boolean)),
    vanbanBiBaiBo: await getLuocDoLinks(page, "#replacedDocument"),
    vanbanBaiBo: await getLuocDoLinks(page, "#replaceDocument"),
    vanbanSuaDoi: await getLuocDoLinks(page, "#amendDocument"),
    vanbanBiSuaDoi: await getLuocDoLinks(page, "#amendedDocument"),
    vanbanDuocHuongDan: await getLuocDoLinks(page, "#guidedDocument"),
    vanbanHuongDan: await getLuocDoLinks(page, "#guideDocument"),
    vanbanBiDinhChinh: await getLuocDoLinks(page, "#correctedDocument"),
    vanbanDinhChinh: await getLuocDoLinks(page, "#correctingDocument"),
    vanbanDuocHopNhat: await getLuocDoLinks(page, "#DuocHopNhatDocument"),
    vanbanHopNhat: await getLuocDoLinks(page, "#HopNhatDocument"),
  };

  return detail;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const allLinks = [];

  try {
    for (let pageNumber = minPage; pageNumber <= maxPage; pageNumber += 1) {
      const links = await collectLinksFromPage(page, pageNumber);
      allLinks.push(...links);
      await humanPause(page, 800, 1500);
    }

    const results = [];
    for (const item of allLinks) {
      const detail = await extractDetail(page, item.link);
      results.push({ ...item, detail });
      await humanPause(page, 1200, 2000);
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`✅ Saved ${results.length} items to ${outputPath}`);
  } catch (error) {
    console.error("❌ Playwright crawler failed:", error);
  } finally {
    await browser.close();
  }
})();
