# JD Order Exporter Local

[![GitHub License](https://img.shields.io/github/license/dubc461/jd-order-exporter-extension-firefox)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/dubc461/jd-order-exporter-extension-firefox)](https://github.com/dubc461/jd-order-exporter-extension-firefox/releases)
[![GitHub Actions Workflow Status](https://github.com/dubc461/jd-order-exporter-extension-firefox/actions/workflows/main.yml/badge.svg)](https://github.com/dubc461/jd-order-exporter-extension-firefox/actions/workflows/main.yml)

一个只在本机浏览器中运行的京东个人订单导出扩展，支持 Chrome 与 Firefox。它复用你当前浏览器已登录京东的会话，请求京东订单列表页和订单详情页，并在本机下载 `CSV` 与 `JSONL` 文件。

本项目 fork 自 [bwjoke/jd-order-exporter-extension](https://github.com/bwjoke/jd-order-exporter-extension)，当前仓库保留 Firefox 兼容改动。

## 特点

- 不读取浏览器 cookie、`localStorage`、密码或其他站点数据。
- 不上传订单数据，不调用第三方接口。
- 只声明访问 `order.jd.com`、`details.jd.com`、`details.yiyaojd.com`。
- 默认脱敏收货人、电话、地址；需要完整本地档案时可以手动取消勾选。
- 详情页链接中的查询参数只用于当次本地抓取，不写入导出文件。

## 获取代码和安装包

当前 fork 的 Firefox 兼容改动在本仓库 `main` 分支中。

推荐从 GitHub Releases 下载对应浏览器的安装包：

- Firefox：`firefox-jd-order-exporter-版本号.xpi`
- Chrome：`chrome-jd-order-exporter-版本号.zip`

也可以直接克隆仓库：

```bash
git clone https://github.com/dubc461/jd-order-exporter-extension-firefox.git
```

或者在 GitHub 页面点击 `Code` -> `Download ZIP`，解压后加载扩展目录。

## 安装

### Chrome

1. 打开 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 解压 `chrome-jd-order-exporter-版本号.zip`，选择解压出来的扩展目录。

### Firefox

需要 Firefox 140 或更新版本。

使用 Release 中的 `firefox-jd-order-exporter-版本号.xpi` 时，可以在 `about:addons` 的齿轮菜单里选择 “Install Add-on From File...” 安装。该安装方式会在浏览器重启后保留。

如果从源码目录临时加载：

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击“Load Temporary Add-on...”。
3. 选择扩展目录中的 `manifest.json`。

临时加载的扩展会在浏览器重启后失效，需要重新加载。

## 使用

1. 在浏览器中打开京东“我的订单”：`https://order.jd.com/center/list.action`。
2. 确认已经登录并能看到订单列表。
3. 点击工具栏里的 `JD Order Exporter Local`。
4. 选择日期范围、订单状态和是否补充详情页字段。
5. 点击“开始导出”，进度会显示在订单页右下角。
6. 完成后会下载两个文件：
   - `jd-orders-*-complete.csv`
   - `jd-orders-*-complete.jsonl`

如果中途点击“停止当前导出”，会下载 `partial` 文件，里面是已经抓到的数据。

## 字段

列表页字段包括：订单编号、父订单编号、店铺名称、商品编号、商品名称、商品数量、实付金额、支付方式、下单时间、订单状态、收货人、地址、电话、售后入口、发票入口。

详情页补充字段包括：付款时间、物流公司、快递单号、配送方式、商品总价、运费、京豆抵扣金额、详情补充状态。

## 隐私与安全

- 扩展只访问 `manifest.json` 中声明的京东域名：`order.jd.com`、`details.jd.com`、`details.yiyaojd.com`。
- 扩展读取当前已登录用户可见的订单列表页，并在用户勾选时读取订单详情页。
- 扩展不会读取或导出 cookies、密码、`localStorage`、IndexedDB 或扩展存储，也不使用分析、遥测或第三方 API。
- 网络请求通过浏览器标准凭据处理复用当前京东登录会话，以便京东返回用户已经有权限查看的页面。
- 扩展不会通过任何远程服务上传、同步或持久化订单数据。导出的数据只会在本机下载为 `CSV` 和 `JSONL` 文件。
- 导出结果可能包含个人订单数据，包括收货人姓名、地址、电话号码、商品名称、金额、支付相关信息、物流公司和快递单号。
- 收货人姓名、地址和电话号码默认会脱敏。用户只能在扩展弹窗中手动取消脱敏。
- 商品名称、店铺、金额、物流字段仍可能暴露个人偏好或消费记录。不要把导出文件发送给不可信的人。
- 不建议长期保留扩展；导出完成后可以在扩展管理页里移除它。

## 注意

全量导出会访问很多订单详情页。建议保持默认请求间隔，必要时按年份分段导出，减少触发京东风控的概率。

本项目与京东没有任何关联，只用于导出本人账号可见的个人订单数据。

## 许可

本项目使用 MIT License。完整文本见 [LICENSE](LICENSE)。

- 原项目版权：Copyright (c) 2026 bwjoke
- Fork 修改版权：Modifications Copyright (c) 2026 dubc461
