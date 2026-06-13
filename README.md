# JD Order Exporter Local

一个只在本机浏览器中运行的京东个人订单导出扩展，支持 Chrome 与 Firefox。它复用你当前浏览器已登录京东的会话，请求京东订单列表页和订单详情页，并在本机下载 `CSV` 与 `JSONL` 文件。

## 特点

- 不读取浏览器 cookie、`localStorage`、密码或其他站点数据。
- 不上传订单数据，不调用第三方接口。
- 只声明访问 `order.jd.com`、`details.jd.com`、`details.yiyaojd.com`。
- 默认脱敏收货人、电话、地址；需要完整本地档案时可以手动取消勾选。
- 详情页链接中的查询参数只用于当次本地抓取，不写入导出文件。

## 下载

推荐从 GitHub Releases 下载扩展安装包：

[jd-order-exporter-local-v0.1.0.zip](https://github.com/bwjoke/jd-order-exporter-extension/releases/download/v0.1.0/jd-order-exporter-local-v0.1.0.zip)

也可以在仓库页面右侧点击 `Releases`，进入最新版本后下载上面的 zip。这个 zip 只包含扩展运行需要的文件，解压后可以在 Chrome 或 Firefox 中加载。

## 安装

### Chrome

1. 打开 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择刚刚解压出来的扩展目录。

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击“Load Temporary Add-on...”。
3. 选择扩展目录中的 `manifest.json`。

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

- 导出的文件保存在本机下载目录，文件内容可能包含订单、商品、地址、电话、物流单号等个人信息。
- 默认开启收货信息脱敏，但商品名称、店铺、金额、物流字段仍可能暴露个人偏好或消费记录。
- 不要把导出的 `jd-orders-*` 文件提交到 GitHub 或发送给不可信的人。
- CSV 输出会对可能被表格软件当作公式执行的单元格加前缀，降低 CSV 公式注入风险。
- 不建议长期保留扩展；导出完成后可以在扩展管理页里移除它。

更多说明见 [PRIVACY.md](PRIVACY.md)。

## 注意

全量导出会访问很多订单详情页。建议保持默认请求间隔，必要时按年份分段导出，减少触发京东风控的概率。

本项目与京东没有任何关联，只用于导出本人账号可见的个人订单数据。
