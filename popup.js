const nowYear = new Date().getFullYear();
const startYearInput = document.getElementById("startYear");
const endYearInput = document.getElementById("endYear");
const dateModeInput = document.getElementById("dateMode");
const statusNode = document.getElementById("statusText");

startYearInput.value = "2014";
endYearInput.value = String(Math.max(2014, nowYear - 1));
startYearInput.max = String(nowYear - 1);
endYearInput.max = String(nowYear - 1);

function setStatus(text) {
  statusNode.textContent = text;
}

function collectOptions() {
  const delayMs = Math.max(300, Number(document.getElementById("delayMs").value || 1000));
  const maxPagesValue = document.getElementById("maxPages").value.trim();
  return {
    dateMode: dateModeInput.value,
    startYear: Number(startYearInput.value || 2014),
    endYear: Number(endYearInput.value || Math.max(2014, nowYear - 1)),
    status: document.getElementById("orderStatus").value,
    delayMs,
    maxPages: maxPagesValue ? Math.max(1, Number(maxPagesValue)) : null,
    includeDetails: document.getElementById("includeDetails").checked,
    maskSensitive: document.getElementById("maskSensitive").checked
  };
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActiveTab(message) {
  const tab = await activeTab();
  if (!tab || !tab.id) {
    throw new Error("没有找到当前标签页。");
  }
  if (!/^https:\/\/order\.jd\.com\/center\/list\.action/.test(tab.url || "")) {
    throw new Error("请先打开京东“我的订单”列表页，再点击扩展。");
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    const noReceiver = /Receiving end does not exist|Could not establish connection/i.test(messageText);
    if (!noReceiver) {
      throw error;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

document.getElementById("start").addEventListener("click", async () => {
  try {
    setStatus("已发送导出任务，进度会显示在订单页右下角。");
    await sendToActiveTab({
      type: "JD_EXPORT_START",
      options: collectOptions()
    });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

document.getElementById("stop").addEventListener("click", async () => {
  try {
    await sendToActiveTab({ type: "JD_EXPORT_STOP" });
    setStatus("已请求停止。");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});
