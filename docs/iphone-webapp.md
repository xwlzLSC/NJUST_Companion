# iPhone 安装方式：HTTPS 网站 + Safari 添加到主屏幕

这条路线不需要 `.ipa`，也不需要苹果开发者账号。思路是把当前项目部署成一个可公开访问的 HTTPS 网站，然后在 iPhone 的 Safari 里“添加到主屏幕”，作为网页 App 使用。

Apple 官方支持把网站添加到主屏幕并作为 Web App 打开：

- https://support.apple.com/is-is/guide/iphone/iphea86e5236/ios

## 这条路线适合什么场景

- 主要是你自己使用
- 不想处理苹果签名、描述文件、证书
- 希望桌面上有独立图标，打开后像 App

## 必须满足的条件

1. 项目必须部署到一个 iPhone 可访问的地址
2. 这个地址必须是 `HTTPS`
3. 前端不能再依赖 `http://127.0.0.1:3030`
4. 最好由你自己的后端去访问教务系统，前端只访问你自己的站点

原因很简单：

- iPhone 上的 Safari 无法使用你电脑本地的 `127.0.0.1`
- 当前教务系统是老 `http` 站点，不适合让手机前端直接访问
- 最稳的方式是：

```text
iPhone Safari -> 你的 HTTPS 站点 -> 你的 Node 服务 -> 教务系统
```

## 当前项目已经具备的基础

当前项目前端请求已经基本是相对路径：

- `/api/status`
- `/api/auth/login`
- `/api/sync/now`
- `/api/classrooms/query`

这意味着只要前端和后端部署在同一个 HTTPS 域名下，就不需要额外改前端接口地址。

此外，服务端现在支持：

- `HOST`
- `PORT`
- `PUBLIC_ORIGIN`

示例：

```bash
HOST=0.0.0.0
PORT=3030
PUBLIC_ORIGIN=https://your-domain.example
```

## 推荐部署方式

### 方案 A：Render 托管 Node 服务

这是现在最省事的路线，适合“没有自己的服务器，只想点几下部署”的场景。

直接看：

- [Render 托管部署说明](./render-deploy.md)

这条路线的结构是：

```text
iPhone Safari -> Render HTTPS 地址 -> 你的 Node 服务 -> 教务系统
```

注意：

- 这是个人实例方案
- 当前后端还是单实例单账号状态，不适合多人共用
- 因为需要持久化登录态和缓存，所以会用到 Render 的付费 web service + persistent disk

### 方案 B：自己维护 Linux 服务器 + Node + Caddy

如果你以后愿意自己维护服务器，再走这条。

准备：

1. 一台云服务器或可公网访问的机器
2. 一个域名
3. 域名解析到你的服务器
4. 安装 Node.js
5. 安装 Caddy

启动项目：

```bash
npm install
HOST=0.0.0.0 PORT=3030 PUBLIC_ORIGIN=https://your-domain.example npm start
```

### Caddy 配置示例

```caddy
your-domain.example {
    encode gzip
    reverse_proxy 127.0.0.1:3030
}
```

这类配置的作用是：

- 自动申请 HTTPS 证书
- 对外暴露 `443`
- 把请求转发给本地 Node 服务

## 部署完成后怎么在 iPhone 上安装

1. 用 iPhone Safari 打开你的 `https://your-domain.example`
2. 登录并确认页面能正常使用
3. 点击 Safari 分享按钮
4. 选择“添加到主屏幕”
5. 回到桌面，点图标即可像独立 App 一样打开

## 这条路线的优点

- 不需要 `.ipa`
- 不需要 Mac
- 不需要苹果开发者账号
- 更新代码后，网站一刷新就是新版本

## 这条路线的限制

- 不是真正的原生 App
- 某些 iOS 后台能力比安卓弱
- 如果你的网站打不开，桌面图标也无法正常使用
- 教务系统登录和会话保活仍然受学校服务端影响

## 适合继续做的优化

如果你后面准备长期走这条路线，建议继续做这几件事：

1. 给项目加 `.env` 配置
2. 给服务器加进程守护，例如 `pm2`
3. 增加 HTTPS 部署文档
4. 增加登录失效提示和重试逻辑
5. 增加面向公网部署时的安全限制，例如速率限制、日志脱敏

## 不建议继续沿用的方式

- 继续只监听 `127.0.0.1`
- 让 iPhone 直接请求学校 `http` 老系统
- 把浏览器本地模式当成正式移动端部署方案
