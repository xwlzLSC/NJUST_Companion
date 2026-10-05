# APK 微信授权与稳定性（2.1.3 / versionCode 15）

设置页保留智慧理工账号密码登录，同时提供「微信二维码登录」与「微信链接登录」。这是学校统一认证的微信授权，不是本应用自建微信账号体系，也不借用学校 AppID 调用微信 SDK。

## 使用

- 二维码：在 APK 获取 → 保存二维码 → 打开微信 → 扫一扫 → 相册选择二维码 → 确认学校授权 → 返回 APK。另一台设备也可以扫码。
- 链接：在 APK 获取 →「复制并打开微信」→ 粘贴到文件传输助手或自己的聊天 → 在微信内点开并确认 → 返回 APK。也保留单独「复制链接」。不自动代发消息、不依赖微信私有分享 Activity；未安装微信时仍可复制，原生操作未响应时释放按钮并提示手动打开。
- 切换二维码 / 链接沿用同一个授权；「重新获取」才更换。返回自动检查，也可手动点「检查授权」。
- 授权约 3 分钟有效。已提交但响应不确定时最多再留 45 秒检查现有会话，不重复提交一次性授权。取消 / 过期后清理本地临时二维码与链接；用户主动保存的相册图片不会自动删除，请自行清理。
- 微信授权成功才替换之前的远程课表、成绩、等级考试和考试数据；本地主题、开学日期、待办等设置不清空。同步失败会明确提示，登录保持成功，可点手动同步。
- 微信授权不保存密码，但可以自动恢复仍有效的教务 / 学校 CAS 会话。恢复顺序：本机加密 Cookie → 教务会话检查 → 使用有效 CAS SSO Cookie 获取新教务会话；没有旧的一次性 ticket 重放。学校统一认证会话真正到期后需再次在微信确认。选择微信后不再偷偷使用旧的已保存密码重登；切换账号密码登录需用户明确操作。
- 从旧版更新后建议重新登录一次建立新版会话，再测试清理后台后重新打开。旧版保存在 WebView 的 Cookie 快照不可靠，不能用于恢复新账号。

## 稳定性改动

- 修复 Capacitor 8 Android `CapacitorCookies.getCookies` 忽略 `url`、读取本地 `document.cookie` 的问题。新增学校专用原生 CookieManager 读写，包含 HttpOnly Cookie 与 `/authserver` 路径；SDK 启动会清理会话 Cookie，因此独立加密快照不可省略。
- 本机快照使用 Android Keystore AES-GCM，与学号 / 微信授权身份 / 待确认挑战绑定；不再把 Cookie 值存到 WebView localStorage。保存原始 HTTP Set-Cookie 的路径、域、安全标志与到期时间，避免重启后生成会遮住服务器新 JSESSIONID 的重复 Cookie。静置超过 30 天的快照不恢复，服务器有效性仍需检查；退出 / 切换登录清理学校 Cookie，不删除其它本地设置。
- 统一认证可能通过 SSO 直接返回已登录教务页，自动恢复不再强行解析密码表单。手动提交新账号必须真实验证密码，不会把旧 SSO 冒充为新学号。网络异常不盲目重复提交密码；会话已失效且开启记住密码时才走密码兜底。
- 新登录在凭据 / 会话保存完成后才发布“已登录”状态，避免用户看到成功后立即清理后台时仍没有可恢复的快照。
- 修复 2.1.2 中保存二维码和复制并打开微信一起卡住的原因：Capacitor 8 的插件代理会合成 `then` 属性，将代理从 `async` 函数返回或直接 `await`，会调用不存在的 `WechatBridge.then()`，外层 Promise 一直不结束。微信组件现在同步获取，只等待真实方法的返回值；启动初始化也不再将组件当作 Promise。
- 微信打开 / 复制的操作有 5 秒 / 3 秒等待上限，返回监听不阻塞按钮。二维码保存的 12 秒上限覆盖图片下载、组件获取及原生保存全过程；下载超时后的迟到结果不会再触发保存。无法自动跳转时保留链接、解锁取消与重试；相册异常可改用链接。正在执行的原生保存不能由前端强制中断，超时后可检查相册是否已保存。
- 授权轮询使用独立状态，不再锁住二维码保存、链接复制、切换方式和取消按钮；仅禁用重复的「检查授权」。取消之后旧检查的迟到响应不会覆盖面板或弹出旧错误。账号登录、同步等会改变会话的操作仍需等待学校检查结束，避免覆盖 Cookie。
- 原生授权获取、二维码加载、授权检查、同步、会话检查、保活与自动恢复均合并重复请求；重复同步等待新结果，不直接返回旧缓存。
- 防止账号登录、验证码刷新、退出和微信授权互相覆盖正在使用的 Cookie；取消的旧检查不能提交授权或覆盖新会话。
- 授权前后保存同一 Cookie 会话，WebView 被系统回收后可以恢复待确认的授权；授权提交状态在 POST 之前保存，超时 / 重启后仅检查会话，不重放授权。
- 后台暂停轮询与倒计时；前台检查从 4 秒起，网络失败退避到最多 15 秒，连续失败 5 次后暂停，用户可手动再检查。
- 暂时断网、HTTP 5xx 或不完整首页不直接判为退出；保留最后确认的登录态及离线课表，显示网络待确认。明确返回学校登录页才判定会话失效。
- HTTP 4xx / 5xx 不作为正常数据页解析，避免错误页被同步为空课表。同步失败保留之前有效数据。
- 应用重启清理持久化的“同步中 / 恢复中”临时标记；Android 返回前台的多个事件合并检查，近期同步成功不重复全量抓取。
- 已有课表完整性检查、变更记录、考试提醒、提醒检查页继续包含在 APK 中。微信没有返回可验证的学号时采用每次授权的独立身份键，防止不同用户的通用「微信授权用户」显示名混用变更历史；重新授权会建立新基线。

## 维护位置

- `index.html`、`css/app.css`：设置页两个入口、二维码 / 链接面板与窄屏排版。
- `js/app.js`：切换方式、保存 / 复制并打开、操作超时、倒计时、后台暂停 / 返回检查、同步结果应用。
- `js/native-sync.js`：学校 CAS 表单、二维码、Cookie、一次性授权、安全跳转、会话恢复与同步去重。
- `android/app/src/main/java/com/njust/companion/WechatBridgePlugin.java`：保存二维码到相册、原生剪贴板、微信启动入口、返回事件。
- `android/app/src/main/java/com/njust/companion/SchoolSessionPlugin.java`：按学校地址读取 Cookie、捕获响应 Cookie 属性、加密保存、身份校验与重启恢复。
- `android/app/src/main/AndroidManifest.xml`：微信可见性与仅 Android 9 及以下的保存图片权限。
- `js/study-features.js`：课表审计按身份键隔离。
- `android/app/build.gradle`、`package.json`：版本信息；`sw.js`：新资源缓存版本。

保存二维码使用 Android MediaStore，只写应用新建的图片；Android 10 及以上不请求读取用户相册，旧系统只在用户点击保存后请求必要写入权限。实现依据 [Android 媒体存储文档](https://developer.android.com/training/data-storage/shared/media) 和 [Capacitor Android 插件文档](https://capacitorjs.com/docs/plugins/android)。

Cookie 读取与持久化依据 [Android CookieManager 文档](https://developer.android.com/reference/android/webkit/CookieManager)；有效 SSO 会话可能直接签发服务票据而不显示密码表单，见 [CAS 协议](https://apereo.github.io/cas/development/protocol/CAS-Protocol-Specification.html)。此次匿名探测确认学校 JSESSIONID 为 HttpOnly，路径 `/authserver`；不读取真实账号或输出 Cookie 值。

## 验证与构建

```text
npm run check
npm run test:apk-login
npm run test:study
npm run test:mini-wechat
npm run apk:debug
```

登录回归新增“清理后台后的原生加密会话恢复”“微信 SSO 续接”“密码兜底”“已有登录页无表单”“身份不匹配拒绝恢复”“原生跳转不响应仍可取消”“保存失败提示但不误报登录失败”等场景。网络 / Cookie / Keystore 测试使用内存模拟，不代表真实学校登录或 Android CookieManager 真机测试。

最终回归通过：APK 登录 / 稳定性 51 项、已有学习功能 23 项、小程序微信登录 18 项（共 92 项），JS / Rust 检查及 Android 编译成功。新增回归加载实际安装的 Capacitor 运行时及插件方法描述，覆盖二维码保存、复制并打开微信、图片下载 / 相册保存超时、学校轮询慢响应和组件不可用；断言代理没有被当作 Promise 读取 `then`。原生方法本身仍由模拟接口实现，不代表 Android 相册或微信真机测试。

Playwright 也加载应用使用的 `js/capacitor.js` 真实代理，在独立测试页面点击「保存二维码」和「复制并打开微信」，两次均调用对应方法并释放按钮；取消及切换按钮可用，`then` 读取次数为零。测试不使用真实账号、真实学校授权或系统剪贴板。APK 内 9 项前端资源与当前源文件逐一比对，版本及 Android 签名验证通过。

产物：`output/releases/NJUST_Companion-2.1.3-wechat-fix-debug.apk`；SHA-256：`E9F636EF6D6BB69DDB097277AD34426F723DDD45468462633E3124A4A021BF27`。本机没有正式签名配置，因此这是可安装的调试签名 APK，不是正式发布包，使用与前一份 2.1.2 调试包相同的证书。正式版本应使用原来的签名密钥构建（已有 GitHub Release 工作流可继续使用），不能通过换签名覆盖已安装的正式版；请勿为解决签名冲突直接卸载而丢失本地数据。

未完成真实手机端学校微信确认、相册写入与返回链路实测。需用户在手机验证这三步；没有自动弹回 APK 的承诺，学校确认后仍需返回 APK。此次未推送 GitHub、发布 Release 或部署小程序云函数。
