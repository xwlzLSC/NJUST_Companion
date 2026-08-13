# Rust 后端迁移说明

从 3.0 起，浏览器部署默认由 `rust-server/` 提供服务。它保留了原有的 `/api/*` 接口，因此现有网页界面、导入数据和 Android 壳不需要重写。

## 运行

安装 Rust 1.85+ 后，在项目根目录运行：

```bash
npm start
```

如果命令行提示找不到 `cargo`，关闭并重新打开 PowerShell；也可以直接运行 `npm start`，它会自动寻找 `C:\Users\你的用户名\.cargo\bin\cargo.exe`。

或直接运行：

```bash
cargo run --release --manifest-path rust-server/Cargo.toml
```

默认地址是 `http://127.0.0.1:3030`。`HOST`、`PORT` 与 `APP_STORAGE_DIR` 环境变量仍然可用。

## 会话与凭据

- Rust 服务对教务请求使用一个串行 Cookie 会话，避免验证码、登录、同步并发时互相覆盖 Cookie。
- 每次抓取前都会轻量校验会话；失效时会明确要求刷新验证码，而不是用过期验证码反复登录。
- 勾选“记住密码”时，密码写入当前系统的凭据库（Windows Credential Manager），`storage/rust-server-state.json` 不保存密码或 Cookie。
- 服务重启后不会恢复旧 Cookie；这是有意的安全边界。下次手动登录会创建新会话。

## 已迁移能力

- 验证码、登录、会话校验与数据同步
- 课表（兼容当前 `#kbtable` 结构）、成绩、等级考试、考试安排
- 空闲教室的校区/楼栋查询与结果解析
- 静态网页托管与原有 API 返回结构

旧版 Node 服务仍保留为 `npm run start:node-legacy`，仅用于紧急回退，不再是默认后端。

## 课表例外

调课和停课是浏览器本机数据，不会回写教务系统，也不会在同步时丢失。请在“周”视图点开课程，选择“本周停课”或“调整时间 / 地点”；课程提醒、首页与桌面组件会使用调整后的实例。
