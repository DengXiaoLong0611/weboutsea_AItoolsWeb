# AI 工具网站

面向 AI 出海业务的工具、案例与服务展示站。当前包含双语展示首页、工具目录、浏览器本地照片排版工具、手绘案例预览、Supabase 身份认证，以及管理员专用 API 与提示词收藏页。百炼图像编辑调用模块与本地测试脚本已实现，但尚未接入网页生成按钮；没有支付、订单、额度或生成任务后台。

## 项目结构

- `PRODUCT.md`：目标用户、定位及内容原则。
- `DESIGN.md`：设计方向与模块结构。
- `ai-tools-site/`：Next.js 16、React 19、TypeScript、Tailwind CSS 4 应用。
- `ai-tools-site/src/data/site-content.ts`：中英文文案、工具、案例、服务与邮箱配置。
- `ai-tools-site/public/tools/pet-photo/`：浏览器本地照片排版、PNG 导出与演示素材。
- `ai-tools-site/public/tools/hand-drawn-photo/`：手绘案例预览，尚未开放在线生成。
- `ai-tools-site/src/lib/pet-photo/bailian.ts`：百炼图像编辑调用封装。
- `ai-tools-site/scripts/test-pet-photo.mjs`：三组手绘测试；默认仅预览，显式传入 `--run` 才调用生成服务。
- `ai-tools-site/src/app/admin/api-library/`：受登录和管理员邮箱白名单保护的收藏页，不存储 API 密钥。
- `.github/workflows/ci.yml`：GitHub 推送及 PR 的单元测试、代码检查、生产构建。

## 本地运行

建议 Node.js 22。以下命令从仓库根目录执行：

```bash
cd ai-tools-site
npm ci
npm run dev
```

访问 http://localhost:3000 。生产验证执行 `npm test`、`npm run lint`、`npm run build`，运行生产服务执行 `npm start`。

## 已有工具与 AI 接入状态

| 功能 | 入口 | 当前能力 |
| --- | --- | --- |
| 工具目录 | `/en?mode=minimal`、`/zh?mode=minimal` | 搜索、分类与可使用工具筛选 |
| 宠物照片 | `/tools/pet-photo` | 本地上传、裁剪、名字与相框排版、打印尺寸、PNG 导出；照片仅在浏览器处理，刷新后不保存 |
| AI 手绘照片 | `/tools/hand-drawn-photo/` | 手绘参考案例预览；不提供在线上传或生成 |
| 私人收藏库 | `/admin/api-library` | 登录后核验管理员邮箱白名单，展示提示词与 API 服务链接 |
| 百炼图像编辑 | 本地 `npm run pet-photo:test` | 服务端调用模块与测试脚本已实现，尚未接入网页 |

落地页生成、短视频等没有实际入口的条目仍是能力介绍或规划内容，不代表已有可使用产品；部分展示状态仍需核实。案例图片是参考素材，不能视作本站生成接口的实测成果。

百炼配置和执行方式见 [百炼宠物手绘配置](docs/百炼宠物手绘配置.md)。正式调用需要有效密钥和服务额度，本地单元测试使用模拟响应，不能证明真实生成可用。所有私密密钥仅在服务端配置，不写入 `public/` 或客户端代码。

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
4. Node.js 版本建议 22.x；身份认证需要配置 Supabase 环境变量，详见 [登录配置说明](docs/Supabase登录配置.md)。
5. 部署后验证首页、语言切换、两种展示风格、移动端布局和邮件入口，再绑定域名。
6. 生产分支选择 `main`；使用 Git 集成后，推送通常会触发相应部署，PR 可用于预览。

`output: "standalone"` 用于现有 Docker 方案，Vercel 部署不需要运行 Docker。Docker/VPS 说明见 [应用 README](ai-tools-site/README.md)。Google 字体在构建时获取，构建环境需能访问对应字体服务。

## 上线前需补齐

- 核实并替换增长数字、客户案例、工具“已上线”状态；当前没有提供相应证明材料。
- 确认 `src/data/site-content.ts` 中的联系邮箱可正常收信；当前仅有 `mailto:`，没有线索表单。
- 宠物照片已有实际工具入口，手绘照片已有案例页；其余没有入口的卡片仍需实现或明确标为规划内容。
- 首页和工具目录已提供独立语言 URL；认证页面及独立照片工具仍需完整翻译和统一导航。
- 若依赖搜索获客，后续增加更多工具详情页、sitemap、robots 和分享图。

## 语言与 URL

- 英文首页 `/en`，中文首页 `/zh`；HTML 分别声明 `lang="en"` 与 `lang="zh-CN"`，包含对应语言描述及 canonical/hreflang 元数据。
- 访问 `/` 时优先采用 `site_locale` Cookie，再读取浏览器 `Accept-Language` 的首选语言；首选中文进入 `/zh`，其他语言默认 `/en`。重定向保留查询参数，不使用 IP 定位。
- 直接访问 `/en` 或 `/zh` 时始终尊重 URL，不受 Cookie 或浏览器语言覆盖。页面加载和手动切换会保存一年语言偏好；需要浏览器允许 Cookie 和 JavaScript，禁用时独立语言 URL 仍可访问。
- 切换语言保留查询参数、当前 Showcase/Minimal 模式与锚点。根地址的个性化重定向使用 `private, no-store`，避免缓存混用。
- 本次双语路由覆盖首页和工具目录；`/auth/*`、`/account`、`/admin/*` 沿用原地址与中文内容，其根 HTML 声明为中文。独立工具保持各自原有语言，不声称已全站翻译。
- 生产环境必须正确填写 `NEXT_PUBLIC_SITE_URL`，用来生成语言页面的 canonical 与替代语言绝对地址；本地缺省来源为 `http://localhost:3000`。

## 验证记录

2026-10-25 本地 Node.js 22.23.2：`npm run lint`、`npm run build` 通过，首页预渲染为静态页面。
2026-10-26 语言路由改造后：`npm ci`、`npm test`（11 项）、`npm run lint`、`npm run build` 均通过。生产服务的 `tests/i18n-smoke.mjs` 和原认证 HTTP 冒烟测试通过；浏览器验证了英文切换中文保留目录模式，以及根地址记住语言偏好。未验证本次云端部署、GitHub Actions 或 Docker 镜像构建；真实认证邮件和 AI 生成仍需单独验收。

## 身份认证

已增加注册、登录、账户、退出及密码重置页面。本地已填写 Supabase 项目 URL、公开密钥及站点地址；此前接入记录确认认证设置接口可用，但尚未完成真实邮件注册、登录与密码重置的全流程验收。Vercel 环境变量、远端回调、邮件模板与 SMTP 的最终状态仍需核验，详见 [Supabase 登录配置](docs/Supabase登录配置.md)。未配置时首页仍可使用，账户服务显示暂未开放。当前认证不会自动限制工具访问或实现计费。
