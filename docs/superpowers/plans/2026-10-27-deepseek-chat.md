# DeepSeek Chat Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. User authorized execution inline by asking to start.

**Goal:** 在现有站点提供安全的 DeepSeek 单模型流式聊天。
**Architecture:** Next Route Handler 代理官方 API；可注入认证和 fetch 的 handler 便于离线验证。客户端消费 NDJSON，页面本地维护会话。
**Tech Stack:** Next.js / React / TypeScript / Node test runner。
**Spec:** ../specs/2026-10-27-deepseek-chat-design.md

## Global Constraints
- 不修改用户已有首页和图片改动；不提交密钥；不发起真实付费生成。
- 中英文独立 URL；现有 Supabase 登录；纯文本输出。

## Review Focus
- UTF-8 与跨 chunk 消息：测试拆分中文流。
- 中途失败不得当成功：测试 error 和缺失结束标志。
- 非法角色与超长请求：拒绝且不调用上游。
- 停止与重试：浏览器验证不出现旧请求覆盖新会话。
- 多实例限流：明确文档限制。

### Task 1: 服务端与协议
Files: src/lib/chat/{server,protocol}.ts, src/app/api/chat/route.ts, tests/chat.test.mjs
- [x] 先写认证、校验、流解析、上游错误与限流测试，运行观察失败。
- [x] 实现 handleChatRequest(request, deps)、SSE/NDJSON 解析与实际路由。
- [x] npm test 全部通过。

### Task 2: 界面与目录
Files: src/components/ai-chat.tsx, ai-chat.css, localized tools/ai-chat/page.tsx, src/data/site-content.ts, src/components/tool-directory.tsx
- [x] 实现双语流式聊天、停止、重试、复制、新会话和登录/未配置状态。
- [x] 添加目录入口，修正目录对本地照片工具的专属描述。
- [x] 浏览器验证桌面/手机、模拟流成功/失败/停止/重试。

### Task 3: 配置与验收
Files: .env.example, README.md, docs/DeepSeek聊天配置.md
- [x] 写服务端密钥配置和限制说明。
- [x] npm test、npm run lint、npm run build，HTTP 冒烟并检查变更范围。

## 执行记录（2026-10-27）

- 已在现有工作目录实现，保留用户原有 site-home.tsx 和照片文件改动；未自动提交、推送或部署。
- 服务端/协议先写失败测试再实现；审查发现中文 byte/character 限制不一致，新增复现测试（413 != 200）后将请求体上限调整至 160 KiB，字符限制保持不变，包含 JSON 转义的最坏合法输入也可通过。
- 使用 DeepSeek 当日官方文档的 `deepseek-flash`，关闭思考；服务端环境变量可替换模型名。
- 适配已有 Cache Components：使用 connection + Suspense 读取运行时配置，移除不兼容的 runtime/dynamic 段配置。
- 独立审查完成：重要问题（长中文请求）已修复；目录静态“待配置”改为中性“内测”与“需登录”，避免配置后仍误报。
- `npm test` 23/23；`npm run lint` 与 `npm run build` 通过。Node test runner 有现存 MODULE_TYPELESS_PACKAGE_JSON 警告，未改动全项目模块配置。
- Chrome 浏览器离线测试通过：1440×960 桌面、390×844 手机、双语、复制、上下文、登录提示、重试、停止、部分回复恢复、新会话取消竞态、未配置状态、纯文本不执行 HTML。上游模拟，无付费调用。
- HTTP 冒烟通过：双语页、语言与 canonical、未知语言404、真实 API 路由401/403、no-store、HTML 不包含密钥。已有 i18n 冒烟通过。
- 整库 diff --check 提示用户原有 site-home.tsx 尾随空白；本次修改的已有文件范围 diff --check 通过，未动用户文件。
- 真实 DeepSeek 密钥、余额与登录后的真实回复尚待配置验收；本次没有真实付费生成，没有共享额度或支付系统。
