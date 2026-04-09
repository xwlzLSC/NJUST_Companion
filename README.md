# 南理教务助手

一个面向南京理工大学学生的本地优先教务工具，提供课表、成绩、四六级、考试安排、空闲教室和常用网站入口，并支持浏览器模式和安卓 APK。

项目的核心思路不是对接官方开放 API，而是登录教务系统后抓取页面 HTML，再在本地解析成结构化数据展示。因此它更像一个“教务系统客户端”。

## 功能

- 课表查询
  - 支持周视图 / 学期视图
  - 支持切换周次
  - 点击课程查看教师、地点、周次、学分、课程号等信息
- 成绩统计
  - 支持按学期查看成绩
  - 支持加权平均分、GPA、勾选统计
  - 支持并入四六级成绩
- 考试安排
  - 展示考试时间、地点、座位号
- 空闲教室
  - 按楼栋、日期、大节查询空教室
- 常用网站
  - 集成学校官网、教务处、图书馆、学习通等入口
- 本地缓存
  - 已同步的数据可离线查看
- 安卓打包
  - 可生成 APK 安装到安卓手机

## 项目结构

```text
.
├─ android/                Capacitor Android 工程
├─ css/                    页面样式
├─ icons/                  图标资源
├─ js/
│  ├─ app.js               前端主逻辑
│  ├─ native-sync.js       安卓端直连同步逻辑
│  ├─ parser.js            教务页面解析器
│  └─ capacitor.js         Capacitor 前端桥接
├─ scripts/
│  ├─ build-android-debug.cjs
│  └─ prepare-capacitor-web.cjs
├─ index.html              入口页面
├─ server.js               本地 Node 服务
├─ manifest.json           PWA 配置
├─ sw.js                   Service Worker
├─ capacitor.config.json   Capacitor 配置
└─ package.json
```

## 数据是怎么来的

本项目的数据来源是教务系统页面，不是数据库直连，也不是官方 JSON 接口。

整体流程如下：

1. 用户登录教务系统
2. 程序向教务系统请求课表、成绩、考试、空闲教室等页面
3. 后端或安卓原生侧拿到 HTML
4. [js/parser.js](./js/parser.js) 解析页面结构
5. 前端渲染成适合手机查看的界面

当前主要抓取来源包括：

- 教务登录入口：`http://202.119.81.113:8080/`
- 业务系统入口：`http://202.119.81.113:9080/njlgdx/` / `http://202.119.81.112:9080/njlgdx/`
- 课表查询页
- 成绩查询页
- 等级考试成绩页
- 考试安排页
- 空闲教室查询页

由于学校系统属于传统 JSP 站点，页面同时存在 GBK / UTF-8 编码、表单跳转、多层查询页等情况，所以解析逻辑集中放在 [js/parser.js](./js/parser.js) 和 [server.js](./server.js)。

## 运行方式

### 1. 浏览器模式

适合在电脑上调试，或通过本地服务打开网页版本。

安装依赖：

```bash
npm install
```

启动本地服务：

```bash
npm start
```

打开：

```text
http://127.0.0.1:3030
```

浏览器模式下：

- 前端页面由 [index.html](./index.html) + [js/app.js](./js/app.js) 驱动
- 本地代理服务由 [server.js](./server.js) 提供接口
- 教务系统 Cookie、同步状态和部分调试页会落在 `storage/`

### 2. 安卓模式

项目使用 Capacitor 封装安卓壳，前端资源会先复制到 `mobile-web/`，再同步到 Android 工程。

准备前端资源：

```bash
npm run build:android:web
```

同步 Android 工程：

```bash
npm run android:sync
```

打调试包：

```bash
npm run apk:debug
```

APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 主要脚本

- `npm start`
  - 启动本地 Node 服务
- `npm run build:android:web`
  - 将前端资源整理到 `mobile-web/`
- `npm run android:sync`
  - 同步前端资源到安卓工程
- `npm run apk:debug`
  - 构建安卓调试包

## 架构说明

### 浏览器模式

```text
页面 -> 本地 Node 服务 -> 教务系统 -> HTML 解析 -> 前端展示
```

主要接口：

- `GET /api/status`
- `GET /api/auth/captcha`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/sync/now`
- `POST /api/settings/semester-start`
- `POST /api/classrooms/query`

### 安卓模式

```text
页面 -> Capacitor 原生网络层 -> 教务系统 -> HTML 解析 -> 前端展示
```

安卓模式下主要由 [js/native-sync.js](./js/native-sync.js) 负责：

- 原生请求
- Cookie 读写
- 会话恢复
- 数据同步

## 本地存储

项目默认是本地优先，不依赖第三方云端数据库。

主要存储位置：

- Web 前端：IndexedDB
- 浏览器模式服务端：`storage/server-state.json`
- 安卓模式：`localStorage + Capacitor Cookies`

用于保存：

- 已同步课表
- 已同步成绩
- 考试安排
- 等级考试成绩
- 登录状态
- 会话信息

## 自动同步

当前实现支持：

- 会话保活
- 手动同步
- 自动同步
- 安卓端 Cookie 快照恢复

但需要注意：

- 学校服务端会话失效后，仍可能需要重新登录
- 清理后台后，恢复效果取决于系统是否保留本地状态
- 页面结构变化后，解析器需要跟着调整

## 已知限制

- 教务系统不是开放 API，页面结构一变就可能导致抓取失效
- 老系统页面存在编码混用，解析时要单独处理
- 小程序不能直接复用当前这套本地服务 / Capacitor 结构
- iOS 不能像安卓一样直接在 Windows 上打可安装包
- 空闲教室功能依赖学校页面当前字段和表单值

## 开发建议

如果你后续要继续维护，优先看这几个文件：

1. [server.js](./server.js)
2. [js/native-sync.js](./js/native-sync.js)
3. [js/parser.js](./js/parser.js)
4. [js/app.js](./js/app.js)

其中：

- 抓取链路有问题，先看 [server.js](./server.js)
- 安卓端同步有问题，先看 [js/native-sync.js](./js/native-sync.js)
- 课表/成绩/考试解析有问题，先看 [js/parser.js](./js/parser.js)
- 界面和交互调整，主要看 [js/app.js](./js/app.js) 和 [css/app.css](./css/app.css)

## 安全与使用说明

- 本项目默认面向个人自用或小范围使用
- 不建议把 `storage/`、调试页、带登录状态的文件上传到公开仓库
- 在公开分发前，建议先清理本地状态文件和测试数据
- 若学校教务系统登录方式、路径或校验规则变更，需自行适配

## 免责声明

本项目与学校官方无关，仅作为个人学习和教务信息整理工具使用。请自行评估使用场景、账号安全和相关规则要求。
