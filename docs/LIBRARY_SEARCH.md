# 图书馆检索（2026-10-02）

小程序和 APK 首页第 8 个“校园网”入口已替换为“图书检索”，仍为每排 4 个、共 8 个功能。APK 设置页的校园网认证卡片也已移除。

支持书名、作者、ISBN/ISSN、主题词、索书号和出版社检索，可筛选文献类型与“仅看可借”，每页 20 条。详情展示 ISBN、定价、载体形态、简介，以及每册图书的校区/馆藏地点、索书号、条码号、借阅状态、应还日期（学校提供时）、还书位置。

这是公开馆藏查询，不是个人借阅/续借服务，不需要智慧理工账号，不使用教务登录状态，不清除课表或账号缓存。没有接入豆瓣等第三方封面服务，图标跟随现有主题配色。

## 小程序启用：需部署新的云函数

1. 用微信开发者工具打开 `E:/NJUST_companion`，确认云函数根目录仍为 `cloudfunctions/`，并选择已经使用的云环境。
2. 右键 `cloudfunctions/njustLibrary`，选择 **上传并部署：云端安装依赖**。本次新增的是 `njustLibrary`，没有修改旧的 `njustSync2` 登录协议。
3. 检查函数配置：超时 **30 秒**、内存 **256 MB**。`config.json` 已提供建议值；若工具未应用，在云控制台同步设置。
4. 清除开发者工具的编译缓存后重新编译/预览，首页点“图书检索”。不要清空登录数据或课表缓存。

新函数没有 OCR 模型，不需要数据库集合、定时触发器、订阅消息模板或新密钥。小程序通过云函数访问学校 HTTP 书目接口，不需要把学校 IP 配进客户端 HTTPS request 合法域名。

本次仅修改本地代码，**没有部署、上传、发布或修改云环境**。若未部署新函数，页面会给出部署提示，不会显示成“没有图书”。

## 文件与接口

- APK/Web 页面：`F:/NJUSTKB/js/library.js`、`index.html`、`css/app.css`。
- 检索合同与解析主文件：`F:/NJUSTKB/js/library-core.js`。
- 小程序页面：`E:/NJUST_companion/miniprogram/pages/library/index.js` / `.wxml` / `.wxss`。
- 小程序调用层：`E:/NJUST_companion/miniprogram/utils/library-api.js`。
- 新云函数：`E:/NJUST_companion/cloudfunctions/njustLibrary/index.js`、`package.json`、`config.json`。
- 浏览器代理：`F:/NJUSTKB/rust-server/src/library.rs`；Node 兼容服务：`integrations/library/server.cjs`。

学校公开接口：

- 检索：`http://202.119.83.14:8080/uopac/opac/openlink.php`。
- 详情：同目录 `item.php?marc_no=<书目编号>`。

接口基于[参考项目 develop 的图书功能](https://github.com/fans963/li_curriculum_table/tree/develop/rust/src/api/book)核对，本次读取提交 `28b44ed626694b526cae5bf57538583bc54331c5`，并匿名验证学校实际返回的 HTML。代码为适配本项目框架重新实现，没有直接复制上游实现。

若学校以后改地址，修改主文件的 `BASE_URL` 和 Rust 文件的 `BASE`，并同步小程序 `utils/library-core.js` 与云函数 `njustLibrary/library-core.js`。测试会检查三份 JS 合同完全一致，防止某一端仍使用旧解析。

## 稳定性与验证

- 固定图书馆主机和端点，不接受任意 URL；书目编号有严格校验；请求禁止自动重定向。
- 有超时和响应大小限制，错误可重试；页面关闭后迟到响应不会重新打开详情或替换新搜索。
- 学校维护、网络失败、无法识别页面与“0 条结果”分开显示。
- 原生 HTTP 插件使用同步获取方式，不对 Capacitor Plugin Proxy 本体使用 await。
- 页面采用现有主题变量，没有固定白字；布局适配手机窄屏。

验证命令：

    npm run test:library
    node scripts/probe-library.cjs
    node scripts/run-rust.cjs test --manifest-path rust-server/Cargo.toml library::tests
    npm run apk:debug

`probe-library.cjs` 仅匿名访问公开书目，在本地执行未部署的云函数处理器，不登录账号、不写数据库、不上传云函数。已验证真实搜索、翻页、图书详情、馆藏位置与状态；浏览器手机宽度交互使用 Playwright 检查。Android 真机和部署后的小程序仍需实机验证。

小程序 WXML 的 `{{...}}` 表达式不能用 `&lt;` 等 HTML 实体代替运算符。上一页按钮使用 `!(view.page > 1)`，避免编译错误。`test:library` 已加入表达式与分页状态回归检查，并在安装了微信开发者工具的 Windows 上调用实际 WXML 编译器；其他环境可通过 `WXML_COMPILER_PATH` 指定编译器路径，未配置或安装时仅跳过该编译检查。此修复只需重新编译小程序，不需要重新上传云函数或重新安装 APK。

2026-10-02 小程序列表修复：结果行改为可点击的全宽 `view`，不再用可能受原生默认尺寸限制的 `button` 承载整张卡片；加载时由事件处理器拦截重复操作。书名 / 作者 / 出版社横向排版，索书号与馆藏数量分层显示，并补齐本页面缺失的检索 / 次级按钮样式和深色状态对比度。`test:library` 共 24 项通过，相关完整 JS 回归共 132 项通过，17 个 WXML 文件以及图书 WXSS 使用安装的微信编译器编译通过。

Playwright 检查使用实际编译的 WXML 和实际主题 / WXSS 的隔离浏览器布局探针，不是真实微信渲染引擎。检查 320 / 390 像素下全部 7 种小程序风格，结果行与列表等宽且无横向溢出；检查还促使补齐按钮样式、窄屏检索按钮尺寸与深色小字对比度。预览：`output/playwright/mini-library-list-fixed-390.png` 和 `mini-library-list-fixed-dark-390.png`。本次没有改动 APK 资源、云函数或用户缓存；真实小程序仍需重新编译 / 预览验证。

## 本次交付 APK

- `F:/NJUSTKB/output/releases/NJUST_Companion-2.1.4-library-debug.apk`（versionCode 16，22,074,330 字节）。
- SHA-256：`C0E69FD466A8F80467576179A545F801892EB82D2A8800A019486181169485D3`。
- 调试签名与之前交付的 2.1.3 调试包一致；不能覆盖使用不同正式签名的 APK。出现签名冲突时不要为了安装测试包而直接卸载、丢失用户数据。
- 已核对安装包内 12 个页面资源与当前源码一致，124 项 JS 回归测试及图书代理 Rust 单元测试通过。
- 浏览器检查了真实检索、详情返回、翻页、首页四列八卡顺序，以及 320/390 像素下八种界面风格的无横向溢出。
- 本次 Playwright 检查促使修正了默认卡片排序，将原 network 排序键同步替换为 library，确保入口仍在第 8 位。

网页版若仍运行旧 Rust 进程，需要在原终端停止后重新 `npm start`，页面强制刷新以载入新资源。本次没有停止用户原先的 3030 服务，仅使用并已关闭隔离的 3032 检查服务。
