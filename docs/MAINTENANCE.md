# 两端工程维护手册

本文说明当前代码在哪里、如何修改与验证。工程整理日期：2026-10-04。所有命令默认在当前 APK/Web 工程根目录执行；小程序在另一独立目录。

## 1. 哪个目录才是源码

```text
F:/NJUSTKB/                         APK / Web 当前工程
├─ index.html                      页面结构、弹窗、主导航
├─ js/                             页面逻辑、原生联网、解析、共享业务
├─ css/                            主题与布局
├─ android/app/src/main/
│  ├─ java/com/njust/companion/     原生插件、会话、加密凭据、通知与组件
│  └─ res/                         Android 原生资源
├─ rust-server/src/                默认网页后端
├─ server.js                       兼容保留的 Node 后端
├─ integrations/wechat/cloud/      云端业务的共享源码副本，回归测试也会使用
├─ scripts/
│  ├─ test-*.cjs / fixtures/        真实回归测试、匿名页面/验证码样本
│  └─ maintenance/                 工程检查、共享文件清单、可恢复清理脚本
├─ models/、eng.traineddata         运行所需 OCR 模型及许可
├─ docs/                           功能与维护说明
├─ mobile-web/                     生成目录，不手改
└─ output/                         APK、调试输出、工具缓存和本次清理归档

E:/NJUST_companion/                 小程序当前工程
├─ miniprogram/
│  ├─ pages/                       各页面 WXML/WXSS/JS/JSON
│  ├─ components/appHeader/        通用安全区页头
│  ├─ custom-tab-bar/              导航栏
│  ├─ utils/                       API、缓存、登录、主题、业务工具
│  └─ app.js、app.json、app.wxss     启动、注册和全局样式
├─ cloudfunctions/                 四个现用云函数
├─ docs/MAINTENANCE.md              小程序侧快速维护索引
├─ .maintenance-backup/            可恢复归档
└─ NJUSTKB/                        带独立 Git 的历史 APK 副本，本次未改动
```

不要修改 `mobile-web/`、Android `assets/public/` 来修 UI，下次同步会被覆盖。旧 `NJUSTKB/` 不参与当前两端构建。

## 2. 常改什么，改哪里

| 要改的内容 | APK / Web | 小程序 | 修改后需要做什么 |
| --- | --- | --- | --- |
| 默认开学日期 | `js/campus-config.js` 的 `fallbackStart` | 两个 campus-config 副本，以及 `utils/constants.js` 的 `DEFAULT_SEMESTER_START` | 同步三个配置副本，测试后重新构建/部署 |
| 官方校历图片 | `js/campus-config.js` 的 `calendar` | 共享 campus-config 副本 | 改学年、图片地址与来源；不加日期识别 |
| 云环境 | APK 不使用小程序云环境 | `utils/cloud-config.js` | 选择同一云环境，部署函数再编译 |
| 登录交互 | `js/app.js`、`js/native-sync.js` | `pages/profile/`、`utils/api.js`、`utils/wechat-login.js` | 用认证回归测试验证，真机复测 |
| 学校认证/重定向 | `native-sync.js`、Rust `main.rs`、兼容 Node `server.js` | `njustSync2/index.js` 及 `lib/wechat-login.js` | 保持表单/验证码/会话绑定，重新部署云函数 |
| 分段周次/数据字段 | `js/parser.js`、Rust `main.rs` | `njustSync2/lib/parser.js` | 用真实匿名表格样本测多个分段，不整文件互相覆盖 |
| 课表完整性/变更 | `js/schedule-insights.js`、`study-features.js` | 共享 insights、`utils/study.js`、`utils/store.js` | 检查账号/学期隔离和错误同步保留基线 |
| 主修学业审查 | `js/campus-core.js`、`campus.js`、Rust `academic_review.rs` | core 副本、`pages/campus/`、`njustSync2` | 保留官方重复项目和原文，不自行推断毕业结论 |
| 图书检索/列表 | `js/library-core.js`、`library.js`、Rust `library.rs` | core 副本、`pages/library/`、`njustLibrary/` | 验证分页、馆藏详情、窄屏列表宽度 |
| 通知/桌面组件 | `js/app.js`、Android 原生插件 | `utils/study.js`、`pages/todos/`、两个提醒云入口 | 不能只测“保存成功”，还要查权限、授权、发送结果 |
| 主题/导航/安全区 | `css/app.css`、`css/campus.css`、`index.html` | `app.wxss`、`utils/theme.js`、页头/导航组件 | 检查所有主题、五个主页面、顶部胶囊与底部安全区 |
| 版本/公告/下载 | `package.json`、Android `build.gradle`、`announcement.json`、发布 workflow | `utils/constants.js` 下载地址 | 正式覆盖更新必须相同签名且 versionCode 递增 |

开学日期当前是 **2026-08-24**。默认日期修改不会覆盖用户已经保存的自定义值；不要让远程课程元数据或校历看图回写自定义日期。

## 3. 跟着数据流读代码

APK：页面操作 → `native-sync.js` → Capacitor 原生 HTTP → 学校统一认证/教务页面 → `parser.js` → 本机缓存 → 页面、提醒和组件。

网页：同一个前端 → 本地 `/api/*` → 默认 Rust 后端 → 学校页面 → 结构化响应。Node 是兼容后端，不是 `npm start` 的默认入口。

小程序：页面 → `utils/api.js` → `njustSync2` → 学校页面/云会话 → `utils/store.js` → `utils/derive.js` → WXML。图书查询独立走 `njustLibrary`。

阅读顺序建议：配置 → 页面入口 → API/会话 → 解析 → 缓存 → 派生展示。先弄清字段从哪里来，再改显示。

### 认证与并发：不能随手删的保护

- 智慧理工 CAS 负责认证，成功后还要进入教务业务系统建立可用会话；“认证提交成功”不等于课程同步完成。
- CAS 手机/桌面表单可能不同。按页面解析 action、隐藏字段和加密要求，不能写死旧表单名。
- 验证码、表单、Cookie 必须来自同一次登录准备。不要在用户输入时后台刷新验证码。
- 单飞 Promise、人工登录保护期、请求代次和账号 owner 校验用于防竞争；页面切换/退出后要忽略迟到结果。
- 微信二维码和链接共用一次短期授权。切模式不要偷偷新建授权；离开前台时停止高频轮询，返回后再检查。
- APK 的凭据和学校 Cookie 由原生加密插件保护。不能为了“自动恢复”把密码写进普通 localStorage。
- 微信登录没有密码可存。失效后提示重新授权，不得悄悄使用另一种登录方式或旧账号密码。

### 数据与提醒：保持边界

- `mergeRemoteData` 用于模块合并，`replaceRemoteData` 用于受检查约束的整次同步；不要无条件将失败响应当成空列表。
- 课表解析要保留 `4-5,8-12(周)` 的全部分段与单双周，不可仅用第一个范围或合并成含 6、7 周的连续区间。
- 课程基线、变更记录、学业审查缓存按账号/学期隔离。
- 学业审查以官方行数据为准，包括重复名称、未获得课程原文；不靠成绩表自行算“已经毕业”。
- 小程序订阅消息：用户授权 → 上传提醒计划 → 云定时扫描 → 真正发送。普通本地待办不是微信订阅授权。
- 模板 ID 在前端 constants、`njustSync2/index.js` 及提醒共享模块中使用；更换模板时查找所有引用及字段映射，不只改 ID。
- Android 通知还需系统权限及系统后台策略；提醒检查页用于显示实际配置，不能保证系统绝不延迟。

## 4. 共享文件：改一份不一定生效

机器可读清单：`scripts/maintenance/shared-files.json`。清单列出必须完全一致的 8 组文件、11 份小程序/云函数副本。

- campus core/config：APK、小程序 utils、同步云函数 lib。
- library core：APK、小程序 utils、图书云函数根目录。
- schedule insights：APK、小程序 utils。
- ddddocr 适配：APK、同步云函数 lib。
- 微信授权、学习提醒、提醒 runner：integrations 源文件与对应云函数。

改完同组文件，运行 `npm run check:projects`；脚本**只检查，不自动覆盖**。

有意保留的不同实现：

1. `js/parser.js` 使用浏览器 DOM，云端 parser 使用 Cheerio；Rust 又有自己的解析路径。业务字段要一致，代码不能整文件复制。
2. 独立 OCR 云函数的 ddddocr 适配与同步云函数版有运行时差异；分别测试，不强制替换。
3. 原生 WXML/WXSS 和网页 HTML/CSS 是两套 UI，改网页不会自动改小程序。

新增注释以 `@maintenance` 标记。注释重点是职责、字段、边界和失败处理，不是把每一行代码翻译成中文。第三方 Capacitor/二维码库、模型、运行时和许可证没有加改写注释。

## 5. 验证与构建

路径默认支持同级 `NJUST_companion`，本机还兼容现有 E 盘目录；换电脑推荐显式设置：

```powershell
$env:NJUST_MINI_ROOT = 'D:\Projects\NJUST_companion'
npm run check:projects
npm run test:all
```

单独 APK 仓库可运行 `npm test` 和 `npm run check:projects`；不存在小程序时会明确提示跳过。完整检查可使用：

```bash
node scripts/maintenance/check-projects.cjs --require-mini
node scripts/run-rust.cjs test --offline --manifest-path rust-server/Cargo.toml
npm run android:sync
npm run apk:debug
```

- JS 回归使用匿名 HTML、模拟网络与验证码样本，不会用你的真实账号自动登录学校。
- Rust 测试中的在线探测默认忽略；不要为了过测试随意启用学校请求。
- 微信开发者工具编译用于检查 WXML/WXSS，再用真机检查按钮、相册权限和导航。
- 前端改完要 `android:sync` 再构建；改云函数要部署对应函数，再编译小程序。
- `config.json` 的内存/超时只是项目配置，仍需确认云端部署确实采用该设置。
- OCR 独立函数依赖只包括模型推理/图片解码，不能引用开发者电脑上的整个 APK 工程。

本次注释后的构建只是验证；没有自动推送、云端发布、版本升级或替换已分发的正式签名 APK。

## 6. 清理范围、保护目录与恢复

只清理经过引用和注册检查的内容：学校调试页面、试验脚本/日志、阶段性总结、微信 quickstart 模板、未注册模板页、未调用旧云函数和 Android 空壳示例测试。真实回归测试、现用页面和当前四个云函数保留。

保留：

- `node_modules/`、工具链 `.rustup/`、Gradle/SDK 及现用下载缓存。
- `storage/`、`.env`、本机私有配置、签名和密钥；不清空用户课程、待办、设置。
- `common_old.onnx`、`eng.traineddata` 等仍被引用的模型；文件名有 old 不代表无用。
- 当前 APK 输出及有用途的 QA 脚本；不把全部 output 一键删除。
- 小程序目录中带独立 Git 历史的旧 APK 工程，未经单独确认不移除。
- 当前被使用或有参考价值的部署、功能文档。

本次初次归档清单：

- APK：`output/maintenance-backup/20261004-002319/manifest.json`。
- 小程序：`.maintenance-backup/20261004-002319/manifest.json`。
- 两份原 README 另存为同目录的 `README.before-maintenance.md`。

清理脚本默认只看计划：

```powershell
powershell -NoProfile -File scripts/maintenance/cleanup-projects.ps1
# 确认明确名单后才执行移动：
powershell -NoProfile -File scripts/maintenance/cleanup-projects.ps1 -Apply
```

**这是可恢复移动，不是永久删除，也不直接释放磁盘空间。** 归档目录已经被 Git 忽略。清单中的 `source` 是原位置，`backup` 是备份位置；恢复前确认原位置没有新文件，再用文件管理器移动回去，避免覆盖当前代码。清单是移动前计划，实际备份是否存在才是恢复依据。

新增清理项前，先 `rg` 查源代码、构建脚本、app.json 和测试引用，不按“看起来像旧文件”判断。不要删除许可证，也不要把独立仓库或用户缓存加入批量清理。
