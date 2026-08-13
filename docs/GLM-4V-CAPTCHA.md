# GLM-4.6V-Flash 验证码识别集成

## ⚠️ 2026-08 更新：浏览器内 OCR 为主路径，GLM 降级为备用

实测 GLM-4.6V-Flash 识别效果不稳定（常触发 1305 限流、识别慢），已按需求**换回浏览器内 OCR 作为主识别路径**：

- **根网页（浏览器）**：登录页验证码留空时，由 `js/app.js` 的 `solveCaptchaWithBrowserOCR()` 调用浏览器本地 Tesseract 识别当前验证码（最多重试 5 次），识别成功才提交；失败则引导手动输入。
- **安卓端（mobile-web）**：`mobile-web/js/native-sync.js` 的 `smartLogin` 一直使用浏览器内 OCR（`solveCaptchaOCR`）。
- **服务端 GLM（Rust / Node）**：**保留为备用**，仅当 API 直接提交空验证码时才触发；正常前端流程不会再走到 GLM。

## 概述

本项目曾集成智谱 AI 的 GLM-4.6V-Flash 视觉模型用于**自动识别验证码**，登录时不用手动输入验证码。相比传统 OCR 具有更高的识别准确率。

覆盖两个后端：
- **Rust 后端（默认）**：`npm start` → `rust-server/`，登录时验证码留空即自动调用 GLM 识别（`rust-server/src/main.rs` 中的 `solve_captcha_glm`）。
- **Node legacy 后端**：`npm run start:node-legacy` → `server.js`，同样支持 GLM + OCR 降级。

## 工作原理

前端登录页验证码为**选填**，留空即触发服务端自动识别：

```
用户只填学号 + 密码 → 点击「登录并同步」
  → 服务端自动获取验证码图片
  → 调用 GLM-4.6V-Flash 识别（配置了 GLM_API_KEY 时）
  → 识别失败/超限流自动重试，最多 15 次登录重试
  → 登录成功后自动同步数据
```

系统采用**智能降级策略**：
1. **优先使用 GLM-4.6V-Flash**：如果配置了 `GLM_API_KEY`，系统会优先调用智谱 AI 视觉模型识别验证码
2. **自动回退到 OCR**：Node legacy 后端在 GLM 识别失败或未配置 API key 时，自动回退到 Tesseract OCR；Rust 后端以 GLM 为主（OCR 见移动端浏览器方案）
3. **多次重试机制**：登录时会自动重试最多 15 次，每次重试都会获取新的验证码并识别
4. **手动兜底**：自动识别连续失败时给出明确提示，仍可手动输入验证码登录

## 配置步骤

### 1. 获取 GLM API Key

访问智谱 AI 开放平台：https://open.bigmodel.cn/

- 注册/登录账号
- 进入控制台获取 API Key
- GLM-4V-Flash 模型价格低廉，适合验证码识别场景

### 2. 配置环境变量

编辑项目根目录的 `.env` 文件：

```bash
# GLM-4V-Flash API Key for captcha recognition
GLM_API_KEY=your_glm_api_key_here
```

如果 `.env` 文件不存在，可以从 `.env.example` 复制：

```bash
cp .env.example .env
```

### 3. 重启服务

```bash
npm start
```

或使用 PM2：

```bash
pm2 restart ecosystem.config.cjs
```

> **注意**：`GLM_API_KEY` 只保存在 `.env`（已被 `.gitignore` 忽略，不会提交）。Rust 与 Node 后端都会读取 `.env`。**云端部署**（Render 等）需要把 `GLM_API_KEY` 手动加为环境变量，才能使用自动识别。

## 验证配置

启动服务后，确认配置生效：

**Rust 后端**（默认），启动日志会打印：

```
GLM captcha auto-recognition configured glm_key_ready=true
```

登录时前端登录框的验证码状态会显示「正在自动识别验证码，无需手动输入…」。

**Node legacy 后端**，登录时控制台会打印：

```
[验证码识别] GLM-4.6V 识别结果: A3b9
```

如果 GLM 失败会自动回退：

```
[验证码识别] GLM-4.6V 识别失败: API error, 回退到增强版 OCR
[验证码识别] 增强版 OCR 识别结果: A3b9
```

## 代码实现

> **Rust 后端（默认）** 有等价的实现：`rust-server/src/main.rs` 中的 `solve_captcha_glm(image, api_key)` 负责调用 GLM API，`login()` 在验证码为空且配置了 `GLM_API_KEY` 时自动获取验证码并识别、最多重试 15 次。以下为 Node legacy 后端的实现。

### 核心函数

```javascript
async function solveCaptcha(buffer) {
  // 优先使用 GLM-4V-Flash，失败时回退到 Tesseract OCR
  if (GLM_API_KEY) {
    try {
      const glmResult = await solveCaptchaGLM(buffer);
      return glmResult;
    } catch (error) {
      console.warn(`GLM-4V 识别失败, 回退到 OCR`);
    }
  }

  // 回退到 OCR
  return await solveCaptchaOCR(buffer);
}
```

### GLM-4V API 调用

```javascript
async function solveCaptchaGLM(buffer) {
  const base64Image = buffer.toString('base64');

  const response = await axios.post(
    'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    {
      model: 'glm-4v-flash',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${base64Image}` }
          },
          {
            type: 'text',
            text: '这是一个验证码图片，请识别图片中的字符...'
          }
        ]
      }],
      temperature: 0.1,
      max_tokens: 10
    },
    {
      headers: {
        'Authorization': `Bearer ${GLM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content.trim();
}
```

## 优势对比

| 特性 | GLM-4V-Flash | Tesseract OCR |
|------|--------------|---------------|
| 识别准确率 | ⭐⭐⭐⭐⭐ 95%+ | ⭐⭐⭐ 60-70% |
| 识别速度 | ⚡ 快速（网络调用） | 🐌 较慢（本地计算） |
| 复杂验证码 | ✅ 支持变形、干扰线 | ❌ 容易失败 |
| 成本 | 💰 按调用次数收费 | 🆓 完全免费 |
| 离线使用 | ❌ 需要网络 | ✅ 完全离线 |

## 性能优化建议

1. **首次登录**：使用 GLM-4V 可以大幅减少重试次数，通常 1-3 次即可成功
2. **降级策略**：保留 OCR 作为备用方案，确保在 API 故障时仍可使用
3. **API 限流**：注意 GLM API 的调用频率限制，避免短时间内大量请求
4. **日志监控**：观察识别成功率，优化 prompt 提示词

## 故障排查

### GLM-4V 无法识别

检查：
- API Key 是否正确配置
- 网络是否可以访问 `open.bigmodel.cn`
- API 账户余额是否充足
- 检查控制台错误日志

### OCR 识别率低

优化方向：
- 图像预处理（二值化、降噪）
- 调整 Tesseract 参数
- 更新 tesseract.js 版本

## 未来改进方向

- [x] Rust 默认后端接入 GLM-4.6V-Flash 自动识别
- [x] 前端验证码改为选填，留空自动识别
- [ ] 添加图像预处理增强 GLM 识别率
- [ ] 支持其他视觉模型（GPT-4V, Claude 3.5 Sonnet）
- [ ] 本地化 ONNX 模型，减少 API 调用成本
- [ ] 验证码识别结果缓存机制

## 参考资料

- [智谱 AI 开放平台文档](https://open.bigmodel.cn/dev/api)
- [GLM-4V 模型介绍](https://open.bigmodel.cn/dev/howuse/model)
- [Tesseract.js 文档](https://tesseract.projectnaptha.com/)
