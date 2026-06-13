/**
 * Crawl session persistence utility
 * Saves and restores crawler state using Chrome storage API
 */

export type CrawlSessionData = {
  timestamp: number;
  currentPage: number;
  totalPages: number;
  collectedLinks: number;
  savedRecords: number;
  configHash: string; // Hash of config to detect config changes
  status: "stopped" | "error" | "paused";
  errorMessage?: string;
};

const STORAGE_KEY = "crawl_session_state";

/**
 * Generate a simple hash of the config for integrity checking
 */
export function generateConfigHash(config: any): string {
  const configStr = JSON.stringify({
    baseUrl: config?.url?.baseUrl,
    minPage: config?.pagination?.minPage,
    maxPage: config?.pagination?.maxPage,
  });
  
  let hash = 0;
  for (let i = 0; i < configStr.length; i++) {
    const char = configStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Save current crawl session state
 */
export async function saveCrawlSession(
  sessionData: CrawlSessionData
): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY]: sessionData,
    });
    console.log("✅ Saved crawl session:", sessionData);
  } catch (error) {
    console.error("❌ Error saving session:", error);
  }
}

/**
 * Get saved crawl session state
 */
export async function getSavedCrawlSession(): Promise<CrawlSessionData | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const session = result[STORAGE_KEY] as CrawlSessionData | undefined;
    
    if (session) {
      console.log("✅ Retrieved saved session:", session);
      return session;
    }
    return null;
  } catch (error) {
    console.error("❌ Error retrieving session:", error);
    return null;
  }
}

/**
 * Clear saved crawl session state
 */
export async function clearCrawlSession(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    console.log("✅ Cleared crawl session");
  } catch (error) {
    console.error("❌ Error clearing session:", error);
  }
}

/**
 * Check if there's a valid saved session that can be resumed
 * Returns null if no valid session or config hash doesn't match
 */
export async function getResumableSession(
  currentConfigHash: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<CrawlSessionData | null> {
  const session = await getSavedCrawlSession();
  
  if (!session) {
    return null;
  }
  
  // Check if config hash matches (user didn't change settings)
  if (session.configHash !== currentConfigHash) {
    console.log("⚠️ Config changed, cannot resume previous session");
    await clearCrawlSession();
    return null;
  }
  
  // Check if session is not too old
  const ageMs = Date.now() - session.timestamp;
  if (ageMs > maxAgeMs) {
    console.log("⚠️ Session too old, discarding");
    await clearCrawlSession();
    return null;
  }
  
  return session;
}
