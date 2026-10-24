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
