// API helper để gọi server lưu dữ liệu

export interface CrawlItem {
  law_id: string;
  name: string;
  so_hieu: string;
  loai_van_ban: string;
  ngay_ban_hanh: string;
  ngay_co_hieu_luc: string;
  ngay_cap_nhat: string;
  noi_ban_hanh: string;
  tinh_trang_hieu_luc: string;
  content: string;
  source_url: string;
}

export async function saveCrawlDataToApi(
  items: CrawlItem[],
  apiEndpoint: string,
  timeout: number = 30000
): Promise<{ success: boolean; message?: string }> {
  try {
    console.log(
      `[API] Gửi ${items.length} records tới API: ${apiEndpoint}`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API error: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    if (data.success) {
      console.log(`[API] Thành công lưu ${items.length} records`);
      return { success: true };
    } else {
      throw new Error(data.message || "API returned success: false");
    }
  } catch (error) {
    const err = error as Error;

    if (err.name === "AbortError") {
      console.error(`[API] Timeout lưu dữ liệu sau ${timeout}ms`);
      return {
        success: false,
        message: `API timeout after ${timeout}ms`,
      };
    }

    console.error(`[API] Lỗi lưu dữ liệu:`, err.message);
    return {
      success: false,
      message: err.message,
    };
  }
}

export function logCrawlItem(item: CrawlItem, excludeFields: string[] = []) {
  const loggableItem: Record<string, any> = {};

  for (const [key, value] of Object.entries(item)) {
    if (!excludeFields.includes(key)) {
      loggableItem[key] = value;
    }
  }

  console.log("[Crawl Data]", loggableItem);
}
