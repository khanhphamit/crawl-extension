import { useEffect, useState } from "react";
import { CrawlConfig } from "../config/default-config";

function App() {
  const [settings, setSettings] = useState({
    // URL Config
    baseUrl: CrawlConfig.url.baseUrl,
    apiEndpoint: CrawlConfig.url.apiEndpoint,

    // Pagination
    minPage: CrawlConfig.pagination.minPage,
    maxPage: CrawlConfig.pagination.maxPage,

    // List Page Selectors
    itemContainer: CrawlConfig.listPageSelectors.itemContainer,
    linkSelector: CrawlConfig.listPageSelectors.linkSelector,
    nameSelector: CrawlConfig.listPageSelectors.nameSelector,
    lawIdSelector: CrawlConfig.listPageSelectors.lawIdSelector,
    lawIdAttribute: CrawlConfig.listPageSelectors.lawIdAttribute,

    // Detail Page Selectors
    soHieuSelector: CrawlConfig.detailPageSelectors.soHieuSelector,
    loaiVanBanSelector: CrawlConfig.detailPageSelectors.loaiVanBanSelector,
    noibanHanhSelector: CrawlConfig.detailPageSelectors.noibanHanhSelector,
    ngayBanHanhSelector: CrawlConfig.detailPageSelectors.ngayBanHanhSelector,
    ngayHieuLucSelector: CrawlConfig.detailPageSelectors.ngayHieuLucSelector,
    ngayCapNhatSelector: CrawlConfig.detailPageSelectors.ngayCapNhatSelector,
    tinhTrangSelector: CrawlConfig.detailPageSelectors.tinhTrangSelector,
    contentSelector: CrawlConfig.detailPageSelectors.contentSelector,
    luocDoButtonSelector: CrawlConfig.detailPageSelectors.luocDoButtonSelector,
    luocDoContentSelector: CrawlConfig.detailPageSelectors.luocDoContentSelector,

    // Batch
    batchSize: CrawlConfig.batch.batchSize,

    // Delay
    delayMultiplier: CrawlConfig.delay.delayMultiplier,
    captchaWaitTime: CrawlConfig.delay.captchaWaitTime / 1000, // lưu theo giây
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get("crawlerSettings", (result) => {
      if (result.crawlerSettings && typeof result.crawlerSettings === "object") {
        const storedSettings = result.crawlerSettings as Record<string, string>;
        setSettings((prev) => ({ ...prev, ...storedSettings }));
      }
    });
  }, []);

  function handleChange(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function saveSettings() {
    chrome.storage.local.set({ crawlerSettings: settings }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function resetToDefaults() {
    setSettings({
      baseUrl: CrawlConfig.url.baseUrl,
      apiEndpoint: CrawlConfig.url.apiEndpoint,
      minPage: CrawlConfig.pagination.minPage,
      maxPage: CrawlConfig.pagination.maxPage,
      itemContainer: CrawlConfig.listPageSelectors.itemContainer,
      linkSelector: CrawlConfig.listPageSelectors.linkSelector,
      nameSelector: CrawlConfig.listPageSelectors.nameSelector,
      lawIdSelector: CrawlConfig.listPageSelectors.lawIdSelector,
      lawIdAttribute: CrawlConfig.listPageSelectors.lawIdAttribute,
      soHieuSelector: CrawlConfig.detailPageSelectors.soHieuSelector,
      loaiVanBanSelector: CrawlConfig.detailPageSelectors.loaiVanBanSelector,
      noibanHanhSelector: CrawlConfig.detailPageSelectors.noibanHanhSelector,
      ngayBanHanhSelector: CrawlConfig.detailPageSelectors.ngayBanHanhSelector,
      ngayHieuLucSelector: CrawlConfig.detailPageSelectors.ngayHieuLucSelector,
      ngayCapNhatSelector: CrawlConfig.detailPageSelectors.ngayCapNhatSelector,
      tinhTrangSelector: CrawlConfig.detailPageSelectors.tinhTrangSelector,
      contentSelector: CrawlConfig.detailPageSelectors.contentSelector,
      luocDoButtonSelector: CrawlConfig.detailPageSelectors.luocDoButtonSelector,
      luocDoContentSelector: CrawlConfig.detailPageSelectors.luocDoContentSelector,
      batchSize: CrawlConfig.batch.batchSize,
      delayMultiplier: CrawlConfig.delay.delayMultiplier,
      captchaWaitTime: CrawlConfig.delay.captchaWaitTime / 1000,
    });
  }

  const renderGroup = (title: string, fields: { key: string; label: string; hint: string }[]) => (
    <div style={{ marginBottom: 24, borderLeft: "4px solid #2196F3", paddingLeft: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", color: "#2196F3" }}>{title}</h3>
      {fields.map((field) => (
        <div key={field.key} style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: "bold", fontSize: 13 }}>
            {field.label}
          </label>
          <input
            type="text"
            value={settings[field.key as keyof typeof settings]}
            onChange={(e) => handleChange(field.key, e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              fontSize: 12,
              fontFamily: "monospace",
              boxSizing: "border-box",
            }}
          />
          <p style={{ color: "#666", fontSize: 12, marginTop: 4, margin: "4px 0 0 0" }}>
            {field.hint}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 800, fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>🔧 TVPL Crawler Settings</h1>

      {saved && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          backgroundColor: "#4CAF50",
          color: "white",
          borderRadius: 4,
        }}>
          ✅ Cài đặt đã được lưu
        </div>
      )}

      {/* URL Config */}
      {renderGroup("🌐 URL Configuration", [
        {
          key: "baseUrl",
          label: "Base URL",
          hint: "URL danh sách văn bản, thay ?page=X hoặc &page=X để crawler thay đổi trang",
        },
        {
          key: "apiEndpoint",
          label: "API Endpoint",
          hint: "URL để gửi dữ liệu crawl đã lưu (POST)",
        },
      ])}

      {/* Pagination */}
      {renderGroup("📄 Pagination", [
        {
          key: "minPage",
          label: "Trang bắt đầu",
          hint: "Trang đầu tiên để crawler duyệt (thường là 1)",
        },
        {
          key: "maxPage",
          label: "Trang kết thúc",
          hint: "Trang cuối cùng để crawler duyệt",
        },
      ])}

      {/* List Page Selectors */}
      {renderGroup("📋 Selectors - Danh sách (List Page)", [
        {
          key: "itemContainer",
          label: "Item Container",
          hint: "CSS selector chứa từng mục trong danh sách (vd: .law-item)",
        },
        {
          key: "linkSelector",
          label: "Link Selector",
          hint: "CSS selector cho link tới trang chi tiết (vd: a.law-link)",
        },
        {
          key: "nameSelector",
          label: "Name Selector",
          hint: "CSS selector cho tên văn bản (vd: .law-name)",
        },
        {
          key: "lawIdSelector",
          label: "Law ID Selector",
          hint: "CSS selector phần tử chứa law ID (vd: .law-id)",
        },
        {
          key: "lawIdAttribute",
          label: "Law ID Attribute",
          hint: "Tên attribute chứa law ID (vd: data-id hoặc id)",
        },
      ])}

      {/* Detail Page Selectors */}
      {renderGroup("📖 Selectors - Chi tiết (Detail Page)", [
        {
          key: "soHieuSelector",
          label: "Số Hiệu Selector",
          hint: "CSS selector cho số hiệu văn bản",
        },
        {
          key: "loaiVanBanSelector",
          label: "Loại Văn Bản Selector",
          hint: "CSS selector cho loại văn bản",
        },
        {
          key: "noibanHanhSelector",
          label: "Nơi Ban Hành Selector",
          hint: "CSS selector cho nơi ban hành",
        },
        {
          key: "ngayBanHanhSelector",
          label: "Ngày Ban Hành Selector",
          hint: "CSS selector cho ngày ban hành",
        },
        {
          key: "ngayHieuLucSelector",
          label: "Ngày Có Hiệu Lực Selector",
          hint: "CSS selector cho ngày có hiệu lực",
        },
        {
          key: "ngayCapNhatSelector",
          label: "Ngày Cập Nhật Selector",
          hint: "CSS selector cho ngày cập nhật",
        },
        {
          key: "tinhTrangSelector",
          label: "Tình Trạng Hiệu Lực Selector",
          hint: "CSS selector cho tình trạng hiệu lực",
        },
        {
          key: "contentSelector",
          label: "Content Selector",
          hint: "CSS selector cho nội dung văn bản (thường là .content hoặc main)",
        },
        {
          key: "luocDoButtonSelector",
          label: "Lược đồ Button Selector",
          hint: "CSS selector cho button/anchor Lược đồ (vd: #aLuocDo)",
        },
        {
          key: "luocDoContentSelector",
          label: "Lược đồ Content Selector",
          hint: "CSS selector cho vùng chứa nội dung lược đồ (vd: #tab4)",
        },
      ])}

      {/* Batch & Delay */}
      {renderGroup("⚡ Performance", [
        {
          key: "batchSize",
          label: "Batch Size",
          hint: "Số lượng records trong mỗi lần gửi API (vd: 10 - 20 records mỗi batch)",
        },
        {
          key: "delayMultiplier",
          label: "Delay Multiplier",
          hint: "Nhân số với delay random (1 = delay random 1-3s, 2 = 2-6s)",
        },
        {
          key: "captchaWaitTime",
          label: "Bot Check Wait Time (giây)",
          hint: "Thời gian đợi (giây) khi gặp bot check tự động, mặc định 10s",
        },
      ])}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button
          onClick={saveSettings}
          style={{
            padding: 12,
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
            flex: 1,
          }}
        >
          💾 Lưu cài đặt
        </button>
        <button
          onClick={resetToDefaults}
          style={{
            padding: 12,
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
            flex: 1,
          }}
        >
          🔄 Khôi phục mặc định
        </button>
      </div>

      {/* Help Section */}
      <div style={{
        marginTop: 24,
        padding: 16,
        backgroundColor: "#e3f2fd",
        borderRadius: 4,
      }}>
        <h3 style={{ marginTop: 0 }}>📚 Hướng dẫn</h3>
        <ol style={{ fontSize: 13, lineHeight: 1.6 }}>
          <li><strong>Mở DevTools:</strong> Nhấn F12 hoặc Ctrl+Shift+I</li>
          <li><strong>Inspector:</strong> Nhấn Ctrl+Shift+C để chọn phần tử trên trang</li>
          <li><strong>Copy Selector:</strong> Chuột phải &gt; Copy &gt; Copy selector</li>
          <li><strong>Dán vào:</strong> Dán CSS selector vào trường tương ứng ở trên</li>
          <li><strong>Test:</strong> Mở console và chạy <code>document.querySelector('selector')</code></li>
        </ol>
      </div>
    </div>
  );
}

export default App;
