// Helper để extract dữ liệu từ DOM

export function extractText(selector: string): string {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      return "";
    }

    let text = element.textContent || "";
    return text.trim();
  } catch (error) {
    console.error(`[DOM Extract] Lỗi extract text từ selector: ${selector}`, error);
    return "";
  }
}

export function extractAttribute(
  selector: string,
  attribute: string
): string {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      return "";
    }

    const value = element.getAttribute(attribute) || "";
    return value.trim();
  } catch (error) {
    console.error(
      `[DOM Extract] Lỗi extract attribute từ selector: ${selector}`,
      error
    );
    return "";
  }
}

export function extractHtml(selector: string): string {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      return "";
    }

    return element.innerHTML;
  } catch (error) {
    console.error(`[DOM Extract] Lỗi extract HTML từ selector: ${selector}`, error);
    return "";
  }
}

export function waitForElement(
  selector: string,
  timeout: number = 10000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);

      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - startTime > timeout) {
        console.warn(
          `[DOM Wait] Timeout chờ element: ${selector} (${timeout}ms)`
        );
        resolve(null);
        return;
      }

      // Kiểm tra lại sau 100ms
      setTimeout(checkElement, 100);
    };

    checkElement();
  });
}

export function waitForPageLoad(timeout: number = 30000): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
      return;
    }

    const startTime = Date.now();
    let lastChangeTime = startTime;
    let previousHeight = document.body.scrollHeight;

    const handleLoad = () => {
      document.removeEventListener("load", handleLoad);
      document.removeEventListener("readystatechange", handleReadyState);
      clearInterval(checkInterval);
      resolve();
    };

    const handleReadyState = () => {
      if (document.readyState === "complete") {
        lastChangeTime = Date.now();
      }
    };

    const checkInterval = setInterval(() => {
      const now = Date.now();

      // Kiểm tra timeout
      if (now - startTime > timeout) {
        console.log(`[Page Load] Timeout sau ${timeout}ms, tiếp tục`);
        document.removeEventListener("load", handleLoad);
        document.removeEventListener("readystatechange", handleReadyState);
        clearInterval(checkInterval);
        resolve();
        return;
      }

      // Kiểm tra nếu page đã "ổn định" (không có thay đổi trong 2 giây)
      const currentHeight = document.body.scrollHeight;
      if (currentHeight !== previousHeight) {
        previousHeight = currentHeight;
        lastChangeTime = now;
      }

      // Nếu document ready và page ổn định thì resolve
      if (document.readyState === "complete" && now - lastChangeTime > 2000) {
        document.removeEventListener("load", handleLoad);
        document.removeEventListener("readystatechange", handleReadyState);
        clearInterval(checkInterval);
        resolve();
      }
    }, 500);

    document.addEventListener("load", handleLoad);
    document.addEventListener("readystatechange", handleReadyState);
  });
}
