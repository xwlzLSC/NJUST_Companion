# 云服务器生产部署

本文档说明如何把当前项目部署到一台公网服务器，并通过 GitHub Actions 在每次推送到 `main` 后自动发布。

如果你不想自己维护服务器，而是想直接托管到第三方平台，优先看：

- [Render 托管部署说明](./render-deploy.md)

## 部署目标

最终结构如下：

```text
浏览器 / iPhone Safari
        ->
你的 HTTPS 域名
        ->
反向代理（Caddy / Nginx）
        ->
Node 服务（server.js）
        ->
学校教务系统
```

## 一次性准备

### 1. 服务器

建议使用一台 Linux 服务器，并满足：

- 已安装 Node.js 20+
- 已安装 npm
- 已安装 `rsync`
- 已开启 SSH 登录
- 有一个可用域名

### 2. 反向代理

推荐用 Caddy，最省事。

示例：

```caddy
your-domain.example {
    encode gzip
    reverse_proxy 127.0.0.1:3030
}
```

### 3. PM2

远程部署脚本会自动尝试安装 PM2，也可以提前手动安装：

```bash
npm install -g pm2
```

## 服务器上的目录建议

例如把项目放到：

```text
/srv/njust-companion
```

这个目录会由 GitHub Actions 自动同步代码。

## 环境变量

项目支持从 `.env` 读取配置。可以参考 [`.env.example`](../.env.example)。

最常用的是：

```env
HOST=127.0.0.1
PORT=3030
PUBLIC_ORIGIN=https://your-domain.example
TRUST_PROXY=true
APP_STORAGE_DIR=./storage
AUTO_SYNC_INTERVAL_MS=600000
KEEP_ALIVE_INTERVAL_MS=480000
```

说明：

- `HOST=127.0.0.1`
  - 推荐让 Node 只监听本机，然后由 Caddy/Nginx 对外暴露
- `PUBLIC_ORIGIN`
  - 你的真实 HTTPS 地址
- `APP_STORAGE_DIR`
  - 用于保存本地状态、Cookie、调试页

## GitHub Actions 自动部署

项目已经带了工作流：

- [`.github/workflows/deploy-server.yml`](../.github/workflows/deploy-server.yml)

触发条件：

- push 到 `main`
- 手动点击 `Run workflow`

工作流会执行：

1. 拉取代码
2. 安装依赖
3. 运行 `npm run check`
4. 通过 SSH / rsync 同步到服务器
5. 上传 `.env`
6. 在服务器执行部署脚本
7. 用 PM2 重启服务

远程部署脚本位置：

- [`scripts/deploy/remote-deploy.sh`](../scripts/deploy/remote-deploy.sh)

## 需要在 GitHub 仓库里配置的 Secrets

进入：

`Repository -> Settings -> Secrets and variables -> Actions`

添加这些 secrets：

### 必填

- `DEPLOY_HOST`
  - 服务器 IP 或域名
- `DEPLOY_PORT`
  - SSH 端口，默认可填 `22`
- `DEPLOY_USER`
  - SSH 登录用户
- `DEPLOY_PATH`
  - 项目部署目录，例如 `/srv/njust-companion`
- `DEPLOY_SSH_KEY`
  - 私钥内容，建议单独生成一把部署用 SSH key

### 推荐

- `APP_ENV_FILE`
  - 多行 `.env` 内容，工作流会自动写到服务器上的 `.env`

示例：

```env
HOST=127.0.0.1
PORT=3030
PUBLIC_ORIGIN=https://your-domain.example
TRUST_PROXY=true
APP_STORAGE_DIR=./storage
AUTO_SYNC_INTERVAL_MS=600000
KEEP_ALIVE_INTERVAL_MS=480000
```

## 服务器首次手动准备

假设你使用 Ubuntu：

```bash
sudo apt update
sudo apt install -y rsync curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
sudo mkdir -p /srv/njust-companion
sudo chown -R $USER:$USER /srv/njust-companion
```

## 部署完成后检查

服务启动后，可以访问：

```text
https://your-domain.example/api/health
```

该接口会返回版本、运行状态和基本健康信息。

## 常用运维命令

查看 PM2 状态：

```bash
pm2 status
```

查看日志：

```bash
pm2 logs njust-companion
```

手动重启：

```bash
cd /srv/njust-companion
set -a
. ./.env
set +a
pm2 restart ecosystem.config.cjs --update-env
```

## 注意事项

- `storage/` 不会从 GitHub Actions 覆盖掉，适合保留本地状态
- 安卓工程和构建目录不会上传到服务器
- 如果你修改了域名，记得同步更新 `PUBLIC_ORIGIN`
- 如果服务前面挂了反向代理，建议开启 `TRUST_PROXY=true`
