import { useEffect, useState } from "react";
import { CrawlConfig } from "../config/default-config";
import {
  generateConfigHash,
  getResumableSession,
  clearCrawlSession,
  type CrawlSessionData,
} from "../utils/crawl-persistence";

type SettingsMap = Record<string, string>;

interface SessionState {
  isRunning: boolean;
  isPaused: boolean;
  currentPage: number;
  totalPages: number;
  collectedLinks: number;
  savedRecords: number;
}

// Helper function to build config from saved settings
function buildConfigFromSettings(settings: SettingsMap) {
  return {
    url: {
      baseUrl: settings.baseUrl || CrawlConfig.url.baseUrl,
      apiEndpoint: settings.apiEndpoint || CrawlConfig.url.apiEndpoint,
    },
    pagination: {
      minPage: parseInt(settings.minPage) || CrawlConfig.pagination.minPage,
      maxPage: parseInt(settings.maxPage) || CrawlConfig.pagination.maxPage,
      pageParamName: "page",
    },
    listPageSelectors: {
      itemContainer: settings.itemContainer || CrawlConfig.listPageSelectors.itemContainer,
      linkSelector: settings.linkSelector || CrawlConfig.listPageSelectors.linkSelector,
      nameSelector: settings.nameSelector || CrawlConfig.listPageSelectors.nameSelector,
      lawIdSelector: settings.lawIdSelector || CrawlConfig.listPageSelectors.lawIdSelector,
      lawIdAttribute: settings.lawIdAttribute || CrawlConfig.listPageSelectors.lawIdAttribute,
      datePublishedSelector: CrawlConfig.listPageSelectors.datePublishedSelector,
      dateEffectiveSelector: CrawlConfig.listPageSelectors.dateEffectiveSelector,
      statusSelector: CrawlConfig.listPageSelectors.statusSelector,
      lastUpdatedSelector: CrawlConfig.listPageSelectors.lastUpdatedSelector,
    },
    detailPageSelectors: {
      soHieuSelector: settings.soHieuSelector || CrawlConfig.detailPageSelectors.soHieuSelector,
      loaiVanBanSelector: settings.loaiVanBanSelector || CrawlConfig.detailPageSelectors.loaiVanBanSelector,
      noibanHanhSelector: settings.noibanHanhSelector || CrawlConfig.detailPageSelectors.noibanHanhSelector,
      ngayBanHanhSelector: settings.ngayBanHanhSelector || CrawlConfig.detailPageSelectors.ngayBanHanhSelector,
      ngayHieuLucSelector: settings.ngayHieuLucSelector || CrawlConfig.detailPageSelectors.ngayHieuLucSelector,
      ngayCapNhatSelector: settings.ngayCapNhatSelector || CrawlConfig.detailPageSelectors.ngayCapNhatSelector,
      tinhTrangSelector: settings.tinhTrangSelector || CrawlConfig.detailPageSelectors.tinhTrangSelector,
      contentSelector: settings.contentSelector || CrawlConfig.detailPageSelectors.contentSelector,
      luocDoButtonSelector: settings.luocDoButtonSelector || CrawlConfig.detailPageSelectors.luocDoButtonSelector,
      luocDoContentSelector: settings.luocDoContentSelector || CrawlConfig.detailPageSelectors.luocDoContentSelector,
    },
    batch: {
      batchSize: parseInt(settings.batchSize) || CrawlConfig.batch.batchSize,
      apiMethod: "POST",
      apiTimeout: 30000,
    },
    delay: {
      delayMultiplier: parseFloat(settings.delayMultiplier) || CrawlConfig.delay.delayMultiplier,
      minDelay: CrawlConfig.delay.minDelay,
      maxDelay: CrawlConfig.delay.maxDelay,
      pageLoadTimeout: CrawlConfig.delay.pageLoadTimeout,
      captchaWaitTime: (parseFloat(settings.captchaWaitTime) || CrawlConfig.delay.captchaWaitTime / 1000) * 1000,
    },
    logging: CrawlConfig.logging,
  };
}

function App() {
  const [statusText, setStatusText] = useState("Chưa bắt đầu");
  const [savedSession, setSavedSession] = useState<CrawlSessionData | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>({
    isRunning: false,
    isPaused: false,
    currentPage: 0,
    totalPages: 0,
    collectedLinks: 0,
    savedRecords: 0,
  });

  useEffect(() => {
    const handleMessage = (
      msg: { type: string; statusText?: string; isRunning?: boolean; isPaused?: boolean; currentPage?: number; totalPages?: number; collectedLinks?: number; savedRecords?: number }
    ) => {
      if (msg.type === "STATUS") {
        setStatusText(msg.statusText || "");
        setSessionState({
          isRunning: msg.isRunning ?? false,
          isPaused: msg.isPaused ?? false,
          currentPage: msg.currentPage ?? 0,
          totalPages: msg.totalPages ?? 0,
          collectedLinks: msg.collectedLinks ?? 0,
          savedRecords: msg.savedRecords ?? 0,
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Lấy state hiện tại từ background khi popup mở lại
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      if (res && res.type === "STATUS") {
        handleMessage(res);
      }
    });

    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Check for saved session on mount
  useEffect(() => {
    (async () => {
      const currentConfig = buildConfigFromSettings({} as any);
      const configHash = generateConfigHash(currentConfig);
      const session = await getResumableSession(configHash);
      if (session) {
        setSavedSession(session);
        const timeAgo = Math.round((Date.now() - session.timestamp) / 1000 / 60); // minutes
        setStatusText(`💾 Tìm thấy session lưu từ ${timeAgo} phút trước (trang ${session.currentPage})`);
      }
    })();
  }, []);

  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  function start() {
    chrome.storage.local.get("crawlerSettings", (result) => {
      const settings = (result.crawlerSettings || {}) as Record<string, string>;
      const config = buildConfigFromSettings(settings);
      chrome.runtime.sendMessage({ type: "START", config, resumeFromSaved: true });
      setSavedSession(null);
    });
  }

  async function resumeSavedSession() {
    chrome.storage.local.get("crawlerSettings", (result) => {
      const settings = (result.crawlerSettings || {}) as Record<string, string>;
      const config = buildConfigFromSettings(settings);
      chrome.runtime.sendMessage({ type: "START", config, resumeFromSaved: true });
      setSavedSession(null);
    });
  }

  async function discardSavedSession() {
    await clearCrawlSession();
    setSavedSession(null);
    setStatusText("Đã xóa session lưu. Bắt đầu lại từ trang đầu.");
  }

  function stop() {
    chrome.runtime.sendMessage({ type: "STOP" });
  }

  function pause() {
    chrome.runtime.sendMessage({ type: "PAUSE" });
  }

  function resume() {
    chrome.runtime.sendMessage({ type: "RESUME" });
  }

  const progress = sessionState.totalPages > 0 
    ? Math.round((sessionState.currentPage / sessionState.totalPages) * 100)
    : 0;

  return (
    <div style={{ padding: 16, width: 450, fontFamily: "system-ui" }}>
      <h2 style={{ margin: "0 0 16px 0", fontSize: 18 }}>
        🔗 TVPL Crawler
      </h2>

      {/* Status Text */}
      <div style={{
        padding: 12,
        marginBottom: 12,
        backgroundColor: "#f5f5f5",
        borderRadius: 4,
        fontSize: 13,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxHeight: 80,
        overflow: "auto",
      }}>
        {statusText || "Chưa bắt đầu"}
      </div>

      {/* Progress Bar */}
      {sessionState.isRunning && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
            <span>Tiến độ</span>
            <span>{progress}%</span>
          </div>
          <div style={{
            width: "100%",
            height: 20,
            backgroundColor: "#e0e0e0",
            borderRadius: 4,
            overflow: "hidden",
          }}>
            <div style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: "#4CAF50",
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 12,
        fontSize: 12,
      }}>
        <div style={{ padding: 8, backgroundColor: "#f9f9f9", borderRadius: 4 }}>
          <div style={{ color: "#666" }}>Trang</div>
          <div style={{ fontSize: 16, fontWeight: "bold" }}>
            {sessionState.currentPage} / {sessionState.totalPages}
          </div>
        </div>
        <div style={{ padding: 8, backgroundColor: "#f9f9f9", borderRadius: 4 }}>
          <div style={{ color: "#666" }}>Links</div>
          <div style={{ fontSize: 16, fontWeight: "bold" }}>
            {sessionState.collectedLinks}
          </div>
        </div>
        <div style={{ padding: 8, backgroundColor: "#f9f9f9", borderRadius: 4 }}>
          <div style={{ color: "#666" }}>Lưu</div>
          <div style={{ fontSize: 16, fontWeight: "bold" }}>
            {sessionState.savedRecords}
          </div>
        </div>
        <div style={{ padding: 8, backgroundColor: "#f9f9f9", borderRadius: 4 }}>
          <div style={{ color: "#666" }}>Trạng thái</div>
          <div style={{ fontSize: 14, fontWeight: "bold" }}>
            {sessionState.isRunning ? "▶️ Chạy" : "⏹️ Dừng"}
          </div>
        </div>
      </div>

      {/* Saved Session Alert */}
      {savedSession && (
        <div style={{
          padding: 12,
          marginBottom: 12,
          backgroundColor: "#FFF3E0",
          borderLeft: "4px solid #FF9800",
          borderRadius: 4,
          fontSize: 13,
        }}>
          <div style={{ marginBottom: 8, fontWeight: "bold" }}>
            💾 Tìm thấy session lưu
          </div>
          <div style={{ marginBottom: 8, fontSize: 12 }}>
            Trang: {savedSession.currentPage} / {savedSession.totalPages}
            <br />
            Links: {savedSession.collectedLinks}
            <br />
            Lưu: {savedSession.savedRecords} records
            <br />
            Trạng thái: {savedSession.status === "error" ? "❌ Lỗi" : "⏹️ Dừng"}
            {savedSession.errorMessage && ` - ${savedSession.errorMessage}`}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button
              onClick={resumeSavedSession}
              style={{
                padding: 8,
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: "bold",
              }}
            >
              ↩️ Tiếp tục
            </button>
            <button
              onClick={discardSavedSession}
              style={{
                padding: 8,
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              🗑️ Xóa
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <button
          onClick={start}
          disabled={sessionState.isRunning}
          style={{
            padding: 10,
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
            opacity: sessionState.isRunning ? 0.6 : 1,
          }}
        >
          ▶️ Bắt đầu
        </button>

        <button
          onClick={stop}
          disabled={!sessionState.isRunning}
          style={{
            padding: 10,
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
            opacity: !sessionState.isRunning ? 0.6 : 1,
          }}
        >
          ⏹️ Dừng
        </button>

        <button
          onClick={pause}
          disabled={!sessionState.isRunning || sessionState.isPaused}
          style={{
            padding: 10,
            backgroundColor: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
            opacity: (!sessionState.isRunning || sessionState.isPaused) ? 0.6 : 1,
          }}
        >
          ⏸️ Tạm dừng
        </button>

        <button
          onClick={resume}
          disabled={!sessionState.isRunning || !sessionState.isPaused}
          style={{
            padding: 10,
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
            opacity: (!sessionState.isRunning || !sessionState.isPaused) ? 0.6 : 1,
          }}
        >
          ▶️ Tiếp tục
        </button>
      </div>

      {/* Settings */}
      <div>
        <button
          onClick={openSettings}
          style={{
            padding: 10,
            width: "100%",
            backgroundColor: "#666",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ⚙️ Cài đặt
        </button>
      </div>
    </div>
  );
}

export default App;
