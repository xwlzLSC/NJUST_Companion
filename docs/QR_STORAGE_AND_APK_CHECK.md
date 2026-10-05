# 2026-10-02 二维码存储修复与 APK 同步检查

## 小程序变更

实际修改的是 `E:\NJUST_companion\miniprogram`，不是 APK 项目的网页副本。

截图错误为「小程序本地存储空间不足」。二维码主路径改为内存画布：优先 Canvas 2D，兼容旧 CanvasContext；使用学校返回的一次性授权链接生成黑白二维码。显示和放大不写图片文件。匿名核对学校原 PNG 的二维码内容，确认与该链接相同。

保存到相册才导出 512×512 临时 PNG；清理仅限本功能的临时导出和严格匹配命名规则的旧二维码缓存。不清空账号、课表等数据，不删除用户相册图片。导出失败仍可直接扫码或改用链接。取消、过期、页面返回、超时和迟到回调均有隔离。

维护位置：

- `E:\NJUST_companion\miniprogram\utils\wechat-login.js`
- `E:\NJUST_companion\miniprogram\utils\wechat-qr-canvas.js`
- `E:\NJUST_companion\miniprogram\utils\qrcode-generator.js`（MIT，2.0.4；完整许可在同目录）
- `E:\NJUST_companion\miniprogram\pages\profile\index.wxml`、`index.wxss`

请在 `E:\NJUST_companion` 项目清除**编译缓存**、重新编译 / 预览并重新获取授权。云端微信授权版本及协议未改变，不需要重新部署现有云函数，不需要清除小程序数据。

## 验证结果

- 14 个相关测试脚本合计 **145 项通过**，无跳过。其中小程序微信登录 **42 项**，覆盖新旧画布、存储满、显示与放大、临时导出、缓存边界、超时、取消、新授权隔离、返回后同步。
- 独立的 `jsQR` 反向解码校验画布像素，不只判断「API 返回成功」。真实学校匿名探测在 145/176/300/512 像素均得到学校 PNG 的相同内容；所有会话、数据库与文件仅在内存，不提交真实账号、不输出或落盘授权码 / Cookie。
- 已安装的微信 WXML 编译器通过全部 **17 个页面 / 组件**；设置页 WXSS 编译通过。新增 / 修改的小程序 JavaScript 语法检查通过。
- 固定 `jsqr@1.4.0` 为测试开发依赖；二维码显示不增加远程服务或运行时下载，不将测试解码器打入 APK。

执行命令：

```text
npm run test:mini-wechat
node scripts/probe-mini-wechat-cloud.cjs
node --test scripts/test-library.cjs scripts/test-mini-wechat-login.cjs scripts/test-mini-login-routes.cjs scripts/test-mini-ocr.cjs scripts/test-mini-stale-shard-recovery.cjs scripts/test-wechat-cas-login.cjs scripts/test-native-stability.cjs scripts/test-native-session-recovery.cjs scripts/test-apk-wechat-ui.cjs scripts/test-native-login-routes.cjs scripts/test-study-features.cjs scripts/test-exam-reminders.cjs scripts/test-academic-cas-login.cjs scripts/test-captcha-flow.cjs
```

## APK 检查

APK 在 WebView 中直接显示学校二维码，不使用小程序 USER_DATA_PATH 文件存储，因此不受同一配额限制。本次没有修改 APK 业务代码，也没有新建发布包。

- 登录 / 会话恢复、二维码保存与链接复制的超时解锁、原生代理、课表分段周次、数据隔离、图书检索、课表审计和考试提醒相关回归通过。
- 检查原生剪贴板和 MediaStore 保存逻辑：链接限学校 HTTPS 授权入口，只在用户操作时保存图片，失败只清理应用创建的不完整图片；不自动向微信聊天发送内容。
- 隔离 Playwright 浏览器加载 APK 当前前端及真实 Capacitor 代理，原生桥、学校授权与馆藏响应使用模拟。保存二维码和「复制并打开微信」均调用成功并释放按钮，原生代理的 `then` 读取为零；模拟确认后显示「已登录」并同步，二维码过期时禁用旧操作并保留重新获取。
- 图书搜索、馆藏地点 / 借阅状态和返回列表走查通过。390 像素屏宽下列表卡片约 361 像素、页面总宽 390，无横向溢出；深色主题文字与背景正常。浏览器走查期间外部更新 / 公告请求被主动阻断，其网络报错不作为 APK 线上故障证据。
- 离线执行 `android\gradlew.bat :app:compileDebugJavaWithJavac --offline --console=plain` 成功（JDK 21，81 项任务为最新状态）。仅检查现有 Java 构建，不重新生成 APK。
- 旧验证码流程测试的截取式模拟上下文缺少新增 CAS / 状态请求变量；补齐测试变量后通过，没有为通过测试更改 APK 登录实现。

现有可安装调试包：`F:\NJUSTKB\output\releases\NJUST_Companion-2.1.4-library-debug.apk`。其中 12 项前端资源逐项哈希核对均与当前源文件一致：HTML、CSS、app/native-sync/parser/features/library-core/library/schedule-insights/study-features/captcha-ocr/captcha-ddddocr。

SHA-256：`C0E69FD466A8F80467576179A545F801892EB82D2A8800A019486181169485D3`。

## 未验证范围

没有已授权连接的 Android 真机。未实测真实手机微信启动、相册权限、学校账号确认、学校到 APK 返回链路及系统清理后台后的实际恢复。小程序真实 Canvas 组件与相册权限同样需要用户在手机验证。上述检查中未发现新的 APK 阻断问题，但不能据此保证所有机型和学校实时服务均正常。

未推送 GitHub、部署云函数、发布 Release、安装或卸载手机应用。只清理本次隔离浏览器 / 本地测试服务，不触碰用户已有的 3030 网页服务。
