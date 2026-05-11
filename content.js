(() => {
  if (window.__jdLocalOrderExporterLoaded) {
    return;
  }
  window.__jdLocalOrderExporterLoaded = true;

  const DATE_LABELS = {
    recent3m: "近三个月订单",
    currentYear: "今年内订单",
    pre2014: "2014年以前订单"
  };

  const STATUS_LABELS = {
    "4096": "全部状态",
    "1024": "已完成",
    "-1": "已取消",
    "128": "等待收货",
    "1": "等待付款"
  };

  const EXPORT_HEADERS = [
    "导出批次",
    "日期范围",
    "订单编号",
    "父订单编号",
    "店铺名称",
    "商品编号",
    "商品名称",
    "商品数量",
    "实付金额",
    "支付方式",
    "付款时间",
    "订单返豆",
    "京豆抵扣金额",
    "下单时间",
    "订单状态",
    "收货人姓名",
    "收货地址",
    "收货人电话",
    "物流公司",
    "快递单号",
    "配送方式",
    "商品总价",
    "运费",
    "详情补充状态",
    "订单详情域名路径",
    "商品明细JSON",
    "有售后入口",
    "有发票入口"
  ];

  let cancelRequested = false;
  let isRunning = false;
  let overlay;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type === undefined) {
      return false;
    }

    if (message.type === "JD_EXPORT_STOP") {
      cancelRequested = true;
      updateOverlay("正在停止，当前请求结束后会保存已抓取数据...");
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === "JD_EXPORT_START") {
      if (isRunning) {
        sendResponse({ ok: false, error: "导出任务已经在运行。" });
        return false;
      }

      isRunning = true;
      cancelRequested = false;
      runExport(message.options || {})
        .catch((error) => {
          updateOverlay(`导出失败：${error instanceof Error ? error.message : String(error)}`, true);
        })
        .finally(() => {
          isRunning = false;
        });
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  async function runExport(options) {
    const batch = timestampForName();
    const dateRanges = buildDateRanges(options);
    const ordersById = new Map();
    const statusLabel = STATUS_LABELS[options.status] || String(options.status || "");

    ensureOverlay();
    updateOverlay(`开始导出：${dateRanges.length} 个日期段，状态：${statusLabel}`);

    for (const range of dateRanges) {
      let page = 1;
      while (!cancelRequested) {
        if (options.maxPages && page > options.maxPages) {
          break;
        }

        const listUrl = buildListUrl(range.value, options.status || "4096", page);
        updateOverlay(`读取 ${range.label} 第 ${page} 页，已收集 ${ordersById.size} 个订单...`);
        const html = await fetchText(listUrl);
        assertLoggedIn(html, listUrl);
        const doc = parseHtml(html);
        const pageOrders = parseOrderList(doc, range.label, batch);

        for (const order of pageOrders) {
          if (!ordersById.has(order["订单编号"])) {
            ordersById.set(order["订单编号"], order);
          }
        }

        const shouldStop = pageOrders.length === 0 || hasListEnded(doc);
        if (shouldStop) {
          break;
        }

        page += 1;
        await delay(options.delayMs);
      }
    }

    const orders = Array.from(ordersById.values());
    if (options.includeDetails && !cancelRequested) {
      for (let i = 0; i < orders.length; i += 1) {
        if (cancelRequested) {
          break;
        }
        const order = orders[i];
        updateOverlay(`补充详情 ${i + 1}/${orders.length}：${maskOrderId(order["订单编号"])}`);
        await enrichOrderFromDetail(order);
        await delay(options.delayMs);
      }
    }

    const finalOrders = orders.map((order) => prepareOutputOrder(order, options.maskSensitive));
    const jsonl = finalOrders.map((order) => JSON.stringify(order)).join("\n");
    const csv = toCsv(finalOrders);
    const suffix = cancelRequested ? "partial" : "complete";

    downloadText(`jd-orders-${batch}-${suffix}.jsonl`, jsonl, "application/x-ndjson;charset=utf-8");
    downloadText(`jd-orders-${batch}-${suffix}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");

    updateOverlay(`导出完成：${finalOrders.length} 个订单，已下载 CSV 和 JSONL。${cancelRequested ? "（已按请求提前停止）" : ""}`, true);
  }

  function buildDateRanges(options) {
    const nowYear = new Date().getFullYear();
    if (options.dateMode === "recent3m") {
      return [{ label: DATE_LABELS.recent3m, value: "1" }];
    }
    if (options.dateMode === "currentYear") {
      return [{ label: DATE_LABELS.currentYear, value: "2" }];
    }
    if (options.dateMode === "customYears") {
      const start = clampYear(options.startYear, 2014, nowYear - 1);
      const end = clampYear(options.endYear, 2014, nowYear - 1);
      const low = Math.min(start, end);
      const high = Math.max(start, end);
      return yearRanges(high, low);
    }

    return [
      { label: DATE_LABELS.currentYear, value: "2" },
      ...yearRanges(nowYear - 1, 2014),
      { label: DATE_LABELS.pre2014, value: "3" }
    ];
  }

  function yearRanges(startYear, endYear) {
    const ranges = [];
    for (let year = startYear; year >= endYear; year -= 1) {
      ranges.push({ label: `${year}年订单`, value: String(year) });
    }
    return ranges;
  }

  function clampYear(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return min;
    }
    return Math.max(min, Math.min(max, Math.trunc(numeric)));
  }

  function buildListUrl(dateValue, statusValue, page) {
    const params = new URLSearchParams({
      d: String(dateValue),
      s: String(statusValue),
      page: String(page)
    });
    return `https://order.jd.com/center/list.action?${params.toString()}`;
  }

  async function fetchText(url) {
    const parsed = new URL(url);
    if (parsed.hostname === location.hostname) {
      const response = await fetch(parsed.href, {
        credentials: "include",
        redirect: "follow"
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`请求失败：HTTP ${response.status}`);
      }
      return text;
    }

    const response = await chrome.runtime.sendMessage({
      type: "JD_EXPORT_FETCH",
      url
    });
    if (!response || !response.ok) {
      const detail = response && response.error ? response.error : `HTTP ${response && response.status}`;
      throw new Error(`请求失败：${detail}`);
    }
    return response.text || "";
  }

  function assertLoggedIn(html, url) {
    const doc = parseHtml(html);
    const title = clean(doc.title);
    const hasLoginForm = Boolean(doc.querySelector("#loginname, #nloginpwd, #loginsubmit, .login-tab, .login-form"));
    const hasPassportRedirect = /passport\.jd\.com\/new\/login\.aspx|ReturnUrl=/.test(html);
    const isLoginTitle = /京东-欢迎登录|欢迎登录/.test(title);
    if (hasLoginForm || hasPassportRedirect || isLoginTitle) {
      throw new Error(`登录状态不可用，请刷新订单页并确认已登录：${safeUrlForMessage(url)}`);
    }
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  function parseOrderList(doc, dateLabel, batch) {
    const rows = Array.from(doc.querySelectorAll(".td-void > tbody"));
    const orders = [];

    for (const row of rows) {
      const rowId = row.getAttribute("id") || "";
      if (rowId.startsWith("parent-")) {
        continue;
      }

      const orderLink = row.querySelector('[name="orderIdLinks"]');
      const orderId = firstMatch(clean(orderLink && orderLink.textContent), /\d{6,}/);
      if (!orderId) {
        continue;
      }

      const amountTexts = Array.from(row.querySelectorAll(".amount span")).map((node) => clean(node.textContent)).filter(Boolean);
      const rowText = clean(row.textContent);
      const detailUrl = normalizeUrl(orderLink.getAttribute("href"));
      const items = parseGoods(row);
      const productIds = items.map((item) => item["商品编号"]).filter(Boolean);
      const productNames = items.map((item) => item["商品名称"]).filter(Boolean);
      const productQty = items.map((item) => item["数量"]).filter((item) => item !== "");
      const paymentMethod = amountTexts.find((text) => !/¥|￥/.test(text)) || firstMatch(rowText, /(在线支付|货到付款|公司转账|京东支付|微信支付|白条支付|银行卡支付)/);
      const actualPayment = parseMoney(amountTexts.find((text) => /¥|￥/.test(text)) || "");

      orders.push({
        "导出批次": batch,
        "日期范围": dateLabel,
        "订单编号": orderId,
        "父订单编号": row.getAttribute("data-parentid") || "",
        "店铺名称": clean(textOf(row, ".shop-txt")),
        "商品编号": productIds.join("\n"),
        "商品名称": productNames.join("\n"),
        "商品数量": productQty.join("\n"),
        "实付金额": actualPayment,
        "支付方式": paymentMethod || "",
        "付款时间": "",
        "订单返豆": parseInteger(textOf(row, 'a[href*="myJingBean/list"]')),
        "京豆抵扣金额": "",
        "下单时间": clean(textOf(row, ".dealtime")),
        "订单状态": clean(textOf(row, ".status span")) || clean(textOf(row, ".order-status")),
        "收货人姓名": clean(textOf(row, ".pc strong")),
        "收货地址": clean(textOf(row, ".pc p:nth-of-type(1)")),
        "收货人电话": clean(textOf(row, ".pc p:nth-of-type(2)")),
        "物流公司": "",
        "快递单号": "",
        "配送方式": "",
        "商品总价": "",
        "运费": "",
        "详情补充状态": "未请求",
        "订单详情域名路径": detailUrl ? hostPath(detailUrl) : "",
        "商品明细JSON": JSON.stringify(items),
        "有售后入口": /申请售后/.test(rowText) ? "是" : "否",
        "有发票入口": /查看发票|发票详情/.test(rowText) ? "是" : "否",
        "_detailUrl": detailUrl
      });
    }

    return orders;
  }

  function parseGoods(row) {
    return Array.from(row.querySelectorAll(".goods-item")).map((item) => {
      const link = item.querySelector(".p-name a.a-link") || item.querySelector(".p-name a") || item.querySelector("a");
      const href = link ? normalizeUrl(link.getAttribute("href")) : "";
      const productId = firstMatch(href, /\d{3,}/);
      const quantityText = clean(textOf(item, ".goods-number")).replace(/^x/i, "");
      return {
        "商品编号": productId || "",
        "商品名称": clean(link ? link.textContent : textOf(item, ".p-name")),
        "数量": quantityText,
        "商品链接": href ? stripQuery(href) : ""
      };
    }).filter((item) => item["商品名称"] || item["商品编号"]);
  }

  function hasListEnded(doc) {
    if (doc.querySelector(".empty-box")) {
      return true;
    }
    return Boolean(doc.querySelector(".next-disabled")) || !doc.querySelector(".next");
  }

  async function enrichOrderFromDetail(order) {
    const detailUrl = order._detailUrl;
    if (!detailUrl || !/^https:\/\/details\.(jd|yiyaojd)\.com\//.test(detailUrl)) {
      order["详情补充状态"] = "无详情链接";
      return;
    }

    try {
      const html = await fetchText(detailUrl);
      assertLoggedIn(html, detailUrl);
      const doc = parseHtml(html);
      const text = compactText(doc.body ? doc.body.textContent : "");
      const stateText = clean(textOf(doc, ".order-state"));

      order["付款时间"] = order["付款时间"] || valueByPatterns(text, [
        /付款时间：\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/
      ]);
      order["支付方式"] = order["支付方式"] || valueByPatterns(text, [
        /付款方式：\s*([^\s：]+支付|货到付款|公司转账|银行卡|微信|白条)/
      ]);
      order["物流公司"] = valueByPatterns(text, [
        /承运人：\s*(.*?)(?:快递咨询|货运单号：|\s{2,}|$)/,
        /国内物流承运方：\s*(.*?)\s*货运单号：/,
        /交付([\u4e00-\u9fa5A-Za-z]+)，/
      ]) || order["物流公司"];
      order["快递单号"] = valueByPatterns(text, [
        /货运单号：\s*([A-Za-z0-9-]+)/,
        /运单号为\s*([A-Za-z0-9-]+)/,
        /快递单号：\s*([A-Za-z0-9-]+)/
      ]) || order["快递单号"];
      order["配送方式"] = valueByPatterns(text, [
        /送货方式：\s*([^\s]+(?:快递|配送|自提)?)/,
        /配送方式：\s*([^\s]+(?:快递|配送|自提)?)/
      ]) || order["配送方式"];
      order["商品总价"] = parseMoney(valueByPatterns(text, [
        /商品总(?:价|额)：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])) || order["商品总价"];
      order["运费"] = parseMoney(valueByPatterns(text, [
        /运费：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])) || order["运费"];
      order["京豆抵扣金额"] = parseMoney(valueByPatterns(text, [
        /京豆：\s*([+－-]?\s*[¥￥]?\s*\d+(?:\.\d+)?)/
      ])) || order["京豆抵扣金额"];

      const returnedBeans = parseInteger(valueByPatterns(text, [/购物返京豆已获得\s*(\d+)\s*京豆/]));
      if (returnedBeans && !order["订单返豆"]) {
        order["订单返豆"] = returnedBeans;
      }
      if (!order["订单状态"] && stateText) {
        order["订单状态"] = stateText;
      }
      order["详情补充状态"] = "成功";
    } catch (error) {
      order["详情补充状态"] = `失败：${error instanceof Error ? error.message : String(error)}`;
    }
  }

  function valueByPatterns(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return clean(match[1]);
      }
    }
    return "";
  }

  function textOf(root, selector) {
    const node = root.querySelector(selector);
    return node ? node.textContent || "" : "";
  }

  function clean(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function compactText(value) {
    return clean(value).replace(/\s*([：:])\s*/g, "$1");
  }

  function firstMatch(value, pattern) {
    const match = String(value || "").match(pattern);
    return match ? match[0] : "";
  }

  function parseMoney(value) {
    const match = String(value || "").replace(/,/g, "").match(/[-+－]?\s*[¥￥]?\s*(\d+(?:\.\d+)?)/);
    return match ? match[1] : "";
  }

  function parseInteger(value) {
    const match = String(value || "").match(/\d+/);
    return match ? String(Number(match[0])) : "";
  }

  function normalizeUrl(href) {
    if (!href) {
      return "";
    }
    if (href.startsWith("//")) {
      return `https:${href}`;
    }
    if (href.startsWith("/")) {
      return `${location.origin}${href}`;
    }
    return href;
  }

  function hostPath(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname}`;
    } catch (_error) {
      return "";
    }
  }

  function safeUrlForMessage(url) {
    return hostPath(url) || "当前页面";
  }

  function stripQuery(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch (_error) {
      return url;
    }
  }

  function maskOrder(order) {
    const copy = { ...order };
    copy["收货人姓名"] = maskName(copy["收货人姓名"]);
    copy["收货地址"] = maskAddress(copy["收货地址"]);
    copy["收货人电话"] = maskPhone(copy["收货人电话"]);
    return copy;
  }

  function prepareOutputOrder(order, shouldMask) {
    const copy = shouldMask ? maskOrder(order) : { ...order };
    delete copy._detailUrl;
    return copy;
  }

  function maskName(value) {
    const text = clean(value);
    if (!text) {
      return "";
    }
    if (text.length <= 1) {
      return "*";
    }
    return `${text[0]}${"*".repeat(Math.max(1, text.length - 1))}`;
  }

  function maskAddress(value) {
    const text = clean(value);
    if (!text) {
      return "";
    }
    const match = text.match(/^(.{0,16}?(?:省|市|区|县))/);
    return match ? `${match[1]}***` : `${text.slice(0, 6)}***`;
  }

  function maskPhone(value) {
    return clean(value).replace(/(\d{3})\d{4}(\d+)/g, "$1****$2");
  }

  function maskOrderId(value) {
    const text = String(value || "");
    return text.replace(/\d(?=\d{4})/g, "*");
  }

  function toCsv(orders) {
    const rows = [EXPORT_HEADERS];
    for (const order of orders) {
      rows.push(EXPORT_HEADERS.map((header) => order[header] ?? ""));
    }
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  function csvCell(value) {
    const rawText = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
    const text = /^[=+\-@\t\r]/.test(rawText) ? `'${rawText}` : rawText;
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function downloadText(fileName, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function timestampForName() {
    const now = new Date();
    const pad = (number) => String(number).padStart(2, "0");
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "-",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join("");
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  function ensureOverlay() {
    if (overlay) {
      return;
    }
    overlay = document.createElement("div");
    overlay.id = "jd-local-exporter-overlay";
    overlay.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:2147483647",
      "width:310px",
      "padding:12px",
      "border:1px solid #d9e2ec",
      "border-radius:8px",
      "box-shadow:0 12px 32px rgba(15,23,42,.18)",
      "background:#fff",
      "color:#102a43",
      "font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"
    ].join(";");
    document.body.appendChild(overlay);
  }

  function updateOverlay(message, done = false) {
    ensureOverlay();
    overlay.textContent = message;
    if (done) {
      const closeButton = document.createElement("button");
      closeButton.textContent = "关闭";
      closeButton.style.cssText = "display:block;margin-top:8px;padding:4px 10px;border:0;border-radius:5px;background:#52606d;color:#fff;cursor:pointer";
      closeButton.addEventListener("click", () => overlay.remove());
      overlay.appendChild(closeButton);
    }
  }
})();
