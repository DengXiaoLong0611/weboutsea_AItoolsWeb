# AI Tools Showcase Site (Next.js)

一个面向 AI 出海项目的展示站模板，支持你持续新增：

- 工具能力（Tools）
- 案例成果（Cases）
- 服务方案（Offers）
- 联系入口（Contact）

核心内容数据在 [`src/data/site-content.ts`](./src/data/site-content.ts)，后续新增内容优先改这个文件即可。

## Local development

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## Production build

```bash
npm run build
npm run start
```

## Deploy option A: Vercel (fastest)

1. 把代码推到 GitHub。
2. 登录 Vercel，导入仓库。
3. Framework 选择 Next.js（会自动识别）。
4. 直接 Deploy。

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

- Showcase 保留深色展示风格；Minimal 为白底平铺工具目录，支持分类、搜索与可用工具筛选。直达：`/?mode=minimal`。
- “宠物照片”入口：`/tools/pet-photo`，支持示例/本地照片、文字、相框版式、打印尺寸和 PNG 导出。目前没有 AI 接口，上传照片只在浏览器中处理，刷新后不保存。
- 目录组件与样式：`src/components/tool-directory.tsx`、`tool-directory.css`。
- 工具内容：`public/tools/pet-photo/index.html`、`style.css`、`app.js`。素材复制自原宠物照片项目，原项目目录未修改；概念图和旧版操作视频均有明确说明。
- 添加新工具：在 `src/data/site-content.ts` 两种语言的 tools 中增加相同 ID、分类和介绍；已有可用页面再填写 href，目录会自动显示入口。独立后端或较大的工具也可以单独部署，并填写其网址。
- 以后接 AI 时，通过服务端 API 调用，密钥放在 Vercel 环境变量中，不能写进 public 文件。
- Vercel 的 Root Directory 使用 `ai-tools-site`，现有 GitHub 集成会随 main 更新自动部署。绑定自有域名时以 Vercel Domains 给出的 DNS 记录为准。
