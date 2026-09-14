# 新版发布说明

- 新增多种界面风格、配色和主题图标，支持独立组合。
- 常用功能统一为每排 4 个、共 8 个，底部导航顺序固定。
- 修复分段周次丢失：例如 `4-5,8-12(周)` 现在在第 4、5、8—12 周显示，第 6—7 周留空。
- 同步修复原生登录、网页代理和 Rust 服务端使用的课表解析入口。
- 更新网页离线缓存版本。

升级后请重新同步课表，补回旧缓存中未采集的周次。

## 发布

在 GitHub Actions 运行 `Android Release`，填写版本名和比已发布版本更大的 `version_code`。工作流使用 GitHub Secrets 中的正式签名生成 APK。

本地 debug APK 使用测试签名，不应替换 Release 的正式签名附件。

## 验证

- `node scripts/test-schedule-weeks.cjs`
- `node scripts/run-rust.cjs test --manifest-path rust-server/Cargo.toml`
- `npm run check`

微信小程序位于单独的项目目录，其云函数不包含在本软件仓库中。
