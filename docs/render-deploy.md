# Render 托管部署：最省事的个人版后端

这份文档对应的是“我不想自己买服务器和运维，只想点几下就把后端挂起来”的方案。

适合的定位是：

- 你自己的私有实例
- 你自己登录、自己同步、自己在 iPhone / Android / 浏览器上用

不适合的定位是：

- 公共多人服务
- 给全校同学共用一个后端

原因很直接：当前服务端状态保存在单个 [storage](../storage) 目录里，登录态、已同步数据、Cookie 都是单实例共享的。要做多人版，需要把账号、会话和缓存按用户隔离，这不是这次“最省事部署”要解决的问题。

## 为什么推荐 Render

这套项目需要的是：

- 长时间运行的 Node 服务
- 一个稳定的 HTTPS 域名
- 持久化目录，用来保存 Cookie、同步缓存和本地状态

Render 刚好能满足这三点，而且支持 `render.yaml` 一键部署。

项目已经带好了：

- [render.yaml](../render.yaml)
- `/api/health` 健康检查
- Render 环境下自动读取 `RENDER_EXTERNAL_URL`

## 成本和限制

这条路线不是纯免费。

因为当前后端要保存登录态和缓存，必须挂持久化磁盘；而 Render 官方文档说明，持久化磁盘只能挂在付费的 web service 上。

所以这份配置默认使用：

- `starter` 实例
- `1 GB` 磁盘

这已经是当前项目能跑起来且不丢状态的最省事方案。

## 一键部署

仓库 README 里已经放了 `Deploy to Render` 按钮。

你也可以直接打开：

```text
https://render.com/deploy?repo=https://github.com/xwlzLSC/NJUST_Companion
```

部署时按下面做：

1. 登录 Render
2. 连接 GitHub
3. 选择当前仓库
4. 确认创建 Blueprint
5. 保持默认的 `starter` + 磁盘配置
6. 点击部署

部署完成后，Render 会给你一个：

```text
https://your-service-name.onrender.com
```

这就是你以后在 iPhone 上访问的地址。

## 部署后立刻要做的两件事

### 1. 打开健康检查地址

访问：

```text
https://your-service-name.onrender.com/api/health
```

如果返回 `ok: true`，说明服务已经起来了。

### 2. 打开首页并完成一次登录

访问：

```text
https://your-service-name.onrender.com
```

然后：

- 输入教务系统账号
- 输入教务系统密码
- 同步一次课表 / 成绩 / 考试
- 在设置里补上学期开始日

## iPhone 使用方式

部署完成后，iPhone 直接这样用：

1. 用 Safari 打开你的 Render 地址
2. 登录并确认同步正常
3. 点击分享按钮
4. 选择“添加到主屏幕”

这样它会以网页 App 方式运行，不需要 `.ipa`，也不需要苹果开发者账号。

## 自动更新怎么做

当前 `render.yaml` 里把 `autoDeployTrigger` 设成了 `off`。

这是故意的。Render 官方建议对“Deploy to Render”按钮使用这个设置，避免你以后每次 push 都触发所有实例自动重部署。

如果这就是你自己的私有实例，并且你希望以后 `push -> 自动部署`，那部署完成后可以去 Render 后台把 Auto-Deploy 改成：

- `On Commit`

这样以后你只要：

1. 本地改代码
2. push 到 GitHub

Render 就会自动重部署。

## 当前 Render 配置说明

[render.yaml](../render.yaml) 里做了这些事：

- `buildCommand: npm install`
- `startCommand: npm start`
- `healthCheckPath: /api/health`
- `HOST=0.0.0.0`
- `TRUST_PROXY=true`
- `APP_STORAGE_DIR=/var/data/storage`
- 挂载 `/var/data` 持久化磁盘

其中最关键的是：

- 只有 `/var/data` 下的数据会长期保留
- 其他目录在重部署后都可能被清空

所以项目的登录状态和缓存必须继续写到 `APP_STORAGE_DIR`

## 建议的使用边界

推荐你把这个实例只当成：

- 自己的私有教务伴侣
- iPhone / Android / 浏览器共用的个人同步后端

不建议把这个地址公开传播给其他人一起登录使用。

如果后面你真的要给多人用，下一步就不是“部署”，而是“重构后端”：

- 增加用户系统
- 每个用户独立 CookieJar
- 每个用户独立存储目录或数据库
- 每个用户独立同步任务

## 常见问题

### 1. 为什么不能直接用 GitHub Pages

因为 GitHub Pages 只能托管静态站点，而你这个项目需要 Node 后端去登录教务系统、维持会话、抓取页面和缓存数据。

### 2. 为什么不用 Vercel / Netlify 这种纯前端平台

因为当前同步逻辑不是一次性 serverless 函数，而是：

- 需要 Cookie 会话
- 需要本地状态
- 需要定时保活和自动同步

这更适合长时间运行的 Node 进程。

### 3. 为什么我部署成功了，还是会重新登录

先检查两件事：

- Render 服务是否真的挂了持久化磁盘
- `APP_STORAGE_DIR` 是否仍然指向 `/var/data/storage`

如果没磁盘，服务重启后登录态一定丢。
