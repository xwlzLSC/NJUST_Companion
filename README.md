# NJUST Companion / 南理教务助手

面向南京理工大学学生的本地优先课程工具，包含网页和 Capacitor Android 应用。登录使用**智慧理工统一认证账号、密码**，也支持学校微信授权的二维码与链接方式。数据来自学校页面解析，本项目不是学校官方客户端。

## 维护从这里开始

- [维护手册](docs/MAINTENANCE.md)：目录职责、常见修改位置、共享副本、测试与清理恢复。
- Android/Web 当前源码在本仓库；小程序是独立工程，当前本机位置为 `E:\NJUST_companion`。
- `mobile-web/` 和 `android/app/src/main/assets/public/` 是生成目录，不是修改页面的入口。
- 小程序工程中保留的 `NJUSTKB/` 是带独立 Git 历史的旧副本，不是当前 APK 源码。
- 本次整理只归档确认无用的内容，不清空账号数据、签名、现用依赖或模型。

## 当前功能

- 课表周视图、学期视图、分段周次、自定义课程、分享与 ICS 导出。
- 成绩查询、统计、GPA 预测；考试时间、地点与倒计时。
- 课表完整性检查、变更记录、考试提醒、提醒检查页。
- 待办、空闲教室、常用网站；图书检索及馆藏位置、可借状态。
- 官方校历图片放大查看、主修学业审查原始结果及未获得课程明细。
- 离线缓存、手动/自动同步；Android 通知及桌面组件。

校历只用于看图，**不识别或自动修改开学日期**。用户自定义日期优先，未设置时使用 `2026-08-24`；修改位置见维护手册。

微信授权与账号密码登录有不同的恢复条件：可恢复有效会话，但微信授权不能产生可保存的密码。授权过期后需要重新确认，应用不能绕过学校微信授权流程。

## 本地网页开发

需要 Node.js、Rust/Cargo；依赖版本以锁文件为准。

```bash
npm ci
npm start
```

访问 `http://127.0.0.1:3030`。

- `npm start` 默认启动 `rust-server/`，由 `scripts/run-rust.cjs` 定位工具链。
- `npm run start:node-legacy` 才启动兼容保留的 `server.js`。
- APK 使用本机原生联网能力，不要求手机连接电脑上的 3030 服务。
- 网页后端是个人单实例会话，不要作为多人共用的公开教务代理。

本机现用的 `.rustup/`、`node_modules/` 及 `storage/` 不属于无用文件。

## 检查与构建

```bash
npm test
npm run test:all
npm run check:projects
npm run check
npm run android:sync
npm run apk:debug
```

- `npm test` 自动跳过缺少小程序工程时无法运行的跨端测试；`test:all` 要求两端都在。
- 换电脑时可用 `NJUST_MINI_ROOT` 指定小程序工程根目录。路径示例见维护手册。
- `check:projects` 检查注册路径、语法、相对依赖、共享副本和云函数锁文件；不连接学校。
- `android:sync` 会从根目录源码重建网页资源；请不要在生成目录里放个人文件。
- `apk:debug` 需要 Android SDK 和 JDK 21，生成 `android/app/build/outputs/apk/debug/app-debug.apk`。
- `npm run apk:release` 使用正式签名配置；发布说明见 [安卓正式版与覆盖更新](docs/android-release.md)。覆盖安装必须保持相同签名。

## 公告与版本发布

- 修改根目录 `announcement.json` 并推送后，客户端可收到普通公告；`active: false` 停用，更换 `id` 表示新公告。
- `.github/workflows/android-release.yml` 发布时生成 `version.json`，使用递增的 `versionCode` 检查更新。
- 正式发布签名保存在本机私有配置或 GitHub Secrets，不应提交密钥文件、密码或 Cookie。
- 本次工程整理不自动推送、发版、部署云函数，也不改版本号。

## 其他说明

- [校历与主修学业审查](docs/CAMPUS_ASSISTANT.md)
- [图书检索](docs/LIBRARY_SEARCH.md)
- [完整性检查、变更与提醒](docs/STUDY_FEATURES.md)
- [APK 微信授权](docs/APK_WECHAT_LOGIN.md)
- [二维码存储与 APK 检查](docs/QR_STORAGE_AND_APK_CHECK.md)
- [Rust 后端](docs/rust-backend.md)

部署与早期方案文档仍保留在 `docs/` 供参考；默认启动方式、当前功能及维护入口以本 README 和维护手册为准。第三方库、OCR 模型和许可证保持原样。

本项目仅用于个人学习和教务信息整理。学校页面或认证机制变化时需要重新适配，请勿公开真实账号、带登录态的调试文件及缓存。
