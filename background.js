const ALLOWED_HOSTS = new Set([
  "order.jd.com",
  "details.jd.com",
  "details.yiyaojd.com"
]);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "JD_EXPORT_FETCH") {
    return false;
  }

  (async () => {
    try {
      const url = new URL(message.url);
      if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
        throw new Error(`Blocked non-JD URL: ${url.hostname}`);
      }

      const response = await fetch(url.href, {
        credentials: "include",
        redirect: "follow"
      });
      const text = await response.text();
      sendResponse({
        ok: response.ok,
        status: response.status,
        finalUrl: response.url,
        text
      });
    } catch (error) {
      sendResponse({
        ok: false,
        status: 0,
        finalUrl: message.url,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();

  return true;
});
