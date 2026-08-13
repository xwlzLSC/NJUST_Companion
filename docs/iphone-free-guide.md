# iPhone 0 成本部署指南 (免费版)

如果你不想买服务器、不想出钱，只想在自己的 iPhone 上稳定使用南理教务助手，**Render 免费版 (Free Plan)** 是目前最推荐的方案。

## 0 成本方案的原理
1. **服务器 (Render)**：提供一个 0 元的 Node.js 运行环境，负责登录学校教务系统并抓取数据。
2. **本地存储 (iPhone)**：虽然免费服务器没有硬盘（重启会丢数据），但你的 iPhone 浏览器 (PWA) 会把课表、成绩存在本地。
3. **PWA 技术**：通过 Safari 的“添加到主屏幕”，让网页看起来和用起来都像一个真正的 App。

---

## 第一步：准备工作
1. 注册一个 [GitHub](https://github.com) 账号。
2. Fork 本项目到你自己的账号下。
3. 注册一个 [Render.com](https://render.com) 账号（建议直接用 GitHub 登录）。

## 第二步：在 Render 部署
1. 在 Render Dashboard 点击 **New** -> **Web Service**。
2. 选择 **Build and deploy from a Git repository**。
3. 连接你的 GitHub 账号，并选中 `NJUST_Companion` 仓库。
4. **关键配置设置**：
   - **Name**: 随便起个名字（例如 `my-njust-app`）。
   - **Region**: 建议选 `Singapore` (新加坡) 或 `Oregon` (俄勒冈)。
   - **Plan**: 必须选 **Free**。
   - **Runtime**: `Node`。
   - **Build Command**: `npm install`。
   - **Start Command**: `npm start`。
5. **添加环境变量 (Advanced)**：
   点击 "Add Environment Variable"，添加：
   - `TRUST_PROXY` = `true`
6. 点击 **Create Web Service**。

## 第三步：iPhone 接入
1. 等待 Render 部署完成（状态显示为 `Live`）。
2. 在浏览器顶部找到 Render 分配给你的网址，通常是 `https://xxx.onrender.com`。
3. **在 iPhone Safari 中打开这个地址**。
4. **进行第一次同步**：
   - 输入学号和教务处密码。
   - 点击“登录并同步”。
   - 看到课表出现后，说明同步成功。
5. **添加到主屏幕**：
   - 点击 Safari 底部的 **分享图标** (带箭头的方框)。
   - 向上滑动，找到并点击 **添加到主屏幕**。
   - 确认添加。

---

## 免费版须知 (与付费版的区别)
> [!IMPORTANT]
> **1. 启动延迟**：Render 免费版在 15 分钟无人访问后会进入“休眠”。当你下次打开 App 时，可能需要等待 10-20 秒让服务器“起床”。
>
> **2. 自动同步限制**：由于服务器会休眠且没有持久化硬盘，服务器端的“定时自动同步”在免费版下不可靠。建议每次想看最新成绩时，手动点一下“同步”按钮。
>
> **3. 登录状态**：如果服务器重启或休眠，你可能需要偶尔重新输入验证码登录。但你的课表数据始终保存在 iPhone 里，不会弄丢。

---

## 进阶推荐：Serv00 (真·0成本且永不休眠)
如果你愿意折腾，[Serv00](https://www.serv00.com/) 是目前最强大的免费主机，提供：
- 真正的持久化存储。
- 允许运行后台 PM2 进程。
- 不会自动休眠。

详细配置方法请参考社区关于 **Serv00 部署 Node.js** 的教程。
