# AI Tools Showcase Site (Next.js)

开发前必读：[技术栈原理与开发指导](./技术栈原理与开发指导.md)。其中的 AI 生成等待反馈原则适用于整个工具栈及未来新增工具。

一个面向 AI 出海项目的展示站与工具目录，已包含本地照片排版工具、手绘案例页、Supabase 身份认证和管理员收藏页，支持你持续新增：

- 工具能力（Tools）
- 案例成果（Cases）
- 服务方案（Offers）
- 联系入口（Contact）

核心内容数据在 [`src/data/site-content.ts`](./src/data/site-content.ts)，后续新增内容优先改这个文件即可。

## Local development

```bash
npm ci
npm run dev
```

打开 `http://localhost:3000`，根据已保存偏好或浏览器语言进入 `/en` 或 `/zh`；非中文浏览器默认英文。

## Production build

```bash
npm run build
npm run start
```

## Deploy option A: Vercel (fastest)

1. 把代码推到 GitHub。
2. 登录 Vercel，导入仓库。
3. Framework 选择 Next.js（会自动识别）。
4. Root Directory 设为 `ai-tools-site`，Node.js 建议 22.x。
5. 按 [Supabase 登录配置](../docs/Supabase登录配置.md) 填写生产环境变量、回调及邮件设置，再部署；修改环境变量后需重新部署。

## Deploy option B: Docker + VPS

### 1) 本地验证镜像

```bash
docker compose up --build
```

访问 `http://localhost:3000`。

### 2) 服务器部署（Ubuntu 示例）

```bash
# 安装 Docker / Docker Compose 插件
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

重新登录后：

```bash
git clone <your-repo-url>
cd ai-tools-site
docker compose up -d --build
```

### 3) 反向代理（Nginx）+ HTTPS

建议用 Nginx 把 80/443 转发到容器 `3000`，并用 Certbot 申请 SSL 证书。

## Domain purchase & binding checklist

你可在 Namecheap / Cloudflare Registrar / GoDaddy 购买域名，步骤如下：

1. 选择主域名（建议 `.com`，简短、易拼写）。
2. 完成购买后，在域名 DNS 管理页新增：
   - `A` 记录：`@` -> 你的服务器公网 IP
   - `A` 记录：`www` -> 你的服务器公网 IP（或 CNAME 到 `@`）
3. 等待 DNS 生效（通常几分钟到 24h）。
4. 在服务器 Nginx 配置 `server_name yourdomain.com www.yourdomain.com`。
5. 使用 Certbot 申请证书并启用 HTTPS。

## Do I need Docker?

不是必须，但推荐：

- **要快、要标准化、方便迁移**：用 Docker（推荐）。
- **只想先上线一个版本**：Vercel 更快。

如果你后续会在 VPS 上长期运营并迭代多个项目，Docker 是更稳妥的基础设施选择。

## 工具目录与宠物照片

- Showcase 保留深色展示风格；Minimal 为白底平铺工具目录，支持分类、搜索与可用工具筛选。直达：`/en?mode=minimal` 或 `/zh?mode=minimal`。
- “宠物照片”入口：`/tools/pet-photo`，支持示例/本地照片、文字、相框版式、打印尺寸和 PNG 导出。网页尚未接入 AI 生成，上传照片只在浏览器中处理，刷新后不保存。
- “AI 手绘照片”入口：`/tools/hand-drawn-photo/`，已接入照片上传、三种画风生成和结果下载；免登录体验 1 次，登录后累计免费 2 次，之后显示购买提示（支付尚未接入）。共享额度需先完成 [手绘额度配置](../docs/手绘额度配置.md)。参考案例不代表本站生成接口的实测结果。
- 目录组件与样式：`src/components/tool-directory.tsx`、`tool-directory.css`。
- 工具内容：`public/tools/pet-photo/index.html`、`style.css`、`app.js`。素材复制自原宠物照片项目，原项目目录未修改；概念图和旧版操作视频均有明确说明。
- 添加新工具：在 `src/data/site-content.ts` 两种语言的 tools 中增加相同 ID、分类和介绍；已有可用页面再填写 href，目录会自动显示入口。独立后端或较大的工具也可以单独部署，并填写其网址。
- 以后接 AI 时，通过服务端 API 调用，密钥放在 Vercel 环境变量中，不能写进 public 文件。
- 百炼服务端调用代码与本地三组手绘测试入口已准备好（已接入手绘网页）：配置 `DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL`、`DASHSCOPE_IMAGE_MODEL`；运行 `npm run pet-photo:test` 仅预览，加 `-- --run` 才实际生成。详见 [百炼宠物手绘配置](../docs/百炼宠物手绘配置.md)。未新增 SDK 依赖。
- Vercel 的 Root Directory 使用 `ai-tools-site`，现有 GitHub 集成会随 main 更新自动部署。绑定自有域名时以 Vercel Domains 给出的 DNS 记录为准。

## 身份认证与私人收藏库

注册、登录、邮箱验证、找回密码、账户和退出流程已实现。本地 Supabase 项目参数已填写，但生产配置与真实邮件全流程仍需验收；本地配置文件不提交仓库。配置步骤见 [Supabase 登录配置](../docs/Supabase登录配置.md)。

`/admin/api-library` 仅允许已登录且邮箱位于 `PRIVATE_LIBRARY_ADMIN_EMAILS` 的用户访问；白名单为空时全部拒绝。该页收集提示词和供应商链接，不提供密钥管理或编辑数据库。详见 [私人收藏库配置](../docs/私人收藏库配置.md)。

## 语言路由

首页/工具目录使用 `/en`、`/zh`，服务端 HTML 语言与内容一致；根地址优先 Cookie，其次浏览器首选语言，非中文回退英文。直接语言 URL 优先，切换保留模式、查询参数和锚点，并保存一年偏好；不依赖 IP 定位。语言组件为 `src/components/locale-switcher.tsx`，协商规则在 `src/lib/i18n.ts`，根地址跳转在 `src/proxy.ts`。

语言根布局在 `src/app/(localized)/[locale]/layout.tsx`，旧认证和账户页面在 `(legacy)` 路由组，公开地址保持不变。旧页面仍为中文，静态照片工具仍保留原有内容；本次不代表全站翻译。canonical/hreflang 使用 `NEXT_PUBLIC_SITE_URL`，生产须填正式站点地址。

启动生产服务后，可设置 `I18N_TEST_URL=http://localhost:3000` 并运行 `node tests/i18n-smoke.mjs`，验证语言协商、HTML、URL 优先级及工具入口。

## 验证与发布边界

`npm test` 包含认证规则和百炼模拟调用测试；`npm run test:smoke` 需要先启动生产服务并设置 `AUTH_TEST_URL`。模拟测试通过不代表真实邮件或 AI 服务已验证。

本地未提交内容不等于线上已发布内容。上线前执行 `npm ci`、`npm test`、`npm run lint`、`npm run build`，并检查部署日志与实际页面；工具状态、案例数字和联系邮箱也应核实。

## LangGraph learning site

The bilingual LangGraph learning guide is served at `/learn/langgraph/` (English) and `/learn/langgraph/zh/` (Chinese). Its vendored upstream snapshot and source notice live in `langgraph-lightning/`; update content only from a reviewed upstream commit, preserve the MIT license and attribution, then rebuild with `npm run docs:langgraph:build`. The normal `npm run build` builds the guide before Next.js so Vercel publishes it with the tool site.
