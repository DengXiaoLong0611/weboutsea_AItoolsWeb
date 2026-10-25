# AI 工具网站

面向 AI 出海业务的工具、案例与服务展示站。当前是前端展示原型，尚无 AI 推理接口、账号、支付、数据库或后台。

## 项目结构

- `PRODUCT.md`：目标用户、定位及内容原则。
- `DESIGN.md`：设计方向与模块结构。
- `ai-tools-site/`：Next.js 16、React 19、TypeScript、Tailwind CSS 4 应用。
- `ai-tools-site/src/data/site-content.ts`：中英文文案、工具、案例、服务与邮箱配置。
- `.github/workflows/ci.yml`：GitHub 推送及 PR 的代码检查、生产构建。

## 本地运行

建议 Node.js 22。以下命令从仓库根目录执行：

```bash
cd ai-tools-site
npm ci
npm run dev
```

访问 http://localhost:3000 。生产验证执行 `npm run lint`、`npm run build`，运行生产服务执行 `npm start`。

## Git 与未来上传 GitHub

仓库根目录是本 README 所在的 `AI工具网站`，应用根目录是 `ai-tools-site`。依赖、构建缓存、本地环境变量不提交。

首次创建远程仓库（先完成 `gh auth login`；下例默认私有仓库）：

```bash
gh repo create ai-tools-site --private --source=. --remote=origin --push
```

如果已经在 GitHub 创建了空仓库，则改用以下命令，不要重复创建：

```bash
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPO.git
git push -u origin main
```

日常更新：

```bash
git status
git add <本次修改的文件>
git commit -m "说明本次修改"
git push
```

## Vercel 部署准备

已确认使用 Vercel，采用 GitHub 仓库导入与持续部署流程。

1. 上传 GitHub 后，在 Vercel 中导入对应仓库。
2. **Root Directory 设为 `ai-tools-site`**，框架选择 Next.js。
3. 安装命令 `npm ci`，构建命令 `npm run build`，输出目录保留平台默认值；不要填 `out`。
4. Node.js 版本建议 22.x；当前应用无需环境变量或数据库。
5. 部署后验证首页、语言切换、两种展示风格、移动端布局和邮件入口，再绑定域名。
6. 生产分支选择 `main`；使用 Git 集成后，推送通常会触发相应部署，PR 可用于预览。

`output: "standalone"` 用于现有 Docker 方案，Vercel 部署不需要运行 Docker。Docker/VPS 说明见 [应用 README](ai-tools-site/README.md)。Google 字体在构建时获取，构建环境需能访问对应字体服务。

## 上线前需补齐

- 核实并替换增长数字、客户案例、工具“已上线”状态；当前没有提供相应证明材料。
- 确认 `hello@aiglobaltoolkit.com` 属于自己且可收信；当前仅有 `mailto:`，没有线索表单。
- 工具卡片当前只作介绍，没有实际使用入口或独立工具详情页。
- 默认内容为中文，但 HTML 语言声明为英文；语言切换使用客户端状态，没有独立英文 URL，也不持久保存偏好。
- 若依赖搜索获客，后续增加工具详情页、多语言路由、sitemap、robots 和分享图；当前仅有全站基础标题与描述。

## 验证记录

2026-10-25 本地 Node.js 22.23.2：`npm run lint`、`npm run build` 通过，首页预渲染为静态页面。
尚未验证 GitHub Actions 实际运行、云端部署、Docker 镜像构建或浏览器交互。
