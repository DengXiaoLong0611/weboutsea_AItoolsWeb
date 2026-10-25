# Supabase 登录配置

## 当前状态

已实现：邮箱注册、验证邮件回调、密码登录、申请密码重置、设置新密码、账户页、退出登录和 SSR 会话刷新。没有新增业务数据表，用户由 Supabase Auth 管理，不需要运行建表 SQL。

尚未完成：关联真实 Supabase 项目、配置邮件发送、生产部署与真实邮件全流程验证。未配置时登录页显示“账户服务暂未开放”。不要把这一状态当作已上线。

## 1. 创建免费项目

在 https://supabase.com/dashboard 登录，在 Free 组织中创建项目。项目数据库密码由网站所有者自行设置并保存；应用接入无需提供数据库密码。不要为了此接入升级套餐。

## 2. 配置环境变量

将 `ai-tools-site/.env.example` 复制成 `ai-tools-site/.env.local`，填入：

- `NEXT_PUBLIC_SUPABASE_URL`：项目 URL，形如 `https://xxx.supabase.co`。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：项目 publishable key（`sb_publishable_...`）。不要使用 secret key 或 service_role key。
- `NEXT_PUBLIC_SITE_URL`：本地 `http://localhost:3000`，生产为实际 HTTPS 域名。不带路径、查询参数或尾部斜杠。

Vercel 的项目 Settings → Environment Variables 中也配置这三个值，之后重新部署。公开 key 不等于数据库管理权限；未来增加业务表时必须开启 RLS 并限定 `auth.uid()`。不要将 `.env.local` 提交 Git。

## 3. 认证设置

Authentication 中开启 Email 注册并保留 Confirm email。密码最短长度设为 12；应用同时限制最长 128 字符。

URL Configuration：

- Site URL：生产 HTTPS 域名。
- Redirect URLs：`https://你的域名/auth/confirm`；本地测试另加 `http://localhost:3000/auth/confirm`。
- 若本地端口改为 3100，环境变量与允许的回调 URL 必须同步改成 3100。
- 不要为生产回调添加任意域名通配符。预览部署默认不启用认证，确有需要时单独配置。

## 4. 邮件模板（必须修改）

本项目使用服务端 token_hash 验证，允许邮件在不同浏览器打开；不处理默认 implicit hash 链接或 PKCE code 链接。请在 Authentication → Email Templates 中替换以下两个模板的链接。

Confirm signup：

```html
<h2>验证你的邮箱</h2>
<p>请点击下方链接完成账户注册。如果不是你操作，请忽略本邮件。</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=signup">验证邮箱</a></p>
```

Reset password：

```html
<h2>重置你的密码</h2>
<p>请点击下方链接设置新密码。如果不是你操作，请忽略本邮件。</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">设置新密码</a></p>
```

`RedirectTo` 由应用配置的固定站点来源生成。回调只接受 signup/recovery，成功后固定进入账户页/设置密码页，忽略任何外部 next 参数。链接含一次性凭据，不要截图公开、记录到分析服务或转发给别人。

## 5. 邮件发送（公开注册前必须完成）

Supabase 内置邮件仅适合测试，存在收件人和速率限制，不能作为向普通公众开放注册的邮件系统。上线前在 Auth 邮件设置中配置自定义 SMTP，例如有免费额度的邮件供应商；实际免费额度、域名验证与限制以供应商当前规则为准。

需要验证发件域名并添加其要求的 DNS 记录。SMTP 密码仅填在 Supabase 后台，不写入 NEXT_PUBLIC 变量或仓库。不要用关闭邮箱验证来绕过邮件配置。

保留 Supabase 认证速率限制；上线后按真实流量观察错误与滥用情况，必要时启用其验证码能力。Supabase 默认速率限制不能替代网站全部防滥用措施。

## 6. 验收

1. `npm ci`、`npm test`、`npm run lint`、`npm run build`。
2. 未登录访问 `/account` 应转到登录页，访问未知 `/auth/xxx` 应返回 404。
3. 用你控制的测试邮箱注册，收到邮件，点击后进入账户页；新浏览器打开邮件链接也应成功。
4. 退出后不能再访问账户信息。错误密码不能登录，正确密码可以登录。
5. 申请重置，点击邮件设置新密码；旧密码应失效，新密码可登录。修改后请求注销该用户全部会话；已签发访问令牌仍可能在到期前有效，这是 Supabase 的令牌生命周期行为。
6. 重复或过期邮件链接应进入错误提示，不应泄露账户信息。
7. 生产域名完成同样一轮验收，并确认验证和重置邮件均能发送给团队之外的邮箱。

## 运维与费用

认证 SDK 开源；Supabase 托管按当前免费套餐额度使用，不承诺永久免费或无限容量。SMTP、域名及部署平台分别有自己的额度或费用。定期检查项目使用量、邮件配额、免费项目的暂停规则。当前没有开通任何付费服务。

此实现只建立身份认证，不会自动为现有工具增加计费、使用次数或访问限制。未来保护 AI 接口时，必须在服务端再次验证用户及其权限。

## 本地验证记录（2026-10-25）

在独立临时副本运行 `npm ci`、`npm test`（2 项）、`npm run lint`、`npm run build` 均通过。分别针对未配置和仅配置占位信息的 standalone 服务执行 `AUTH_TEST_URL=http://127.0.0.1:端口 npm run test:smoke`，页面渲染、未登录拦截、安全回调跳转和未知路由 404 均通过。占位配置没有连接真实 Supabase 项目，也未发送邮件。

当前未验证：真实注册/登录、邮件投递与链接验证、真实密码更新、生产部署以及浏览器视觉/交互检查。测试进程仅用于本地验收，不是部署服务。

## 控制台接入进展（2026-10-25）

已在 Chrome 确认登录，组织显示 Free，项目引用为 `porkwrbitbjgeroyaosq`。观察到网站部署域名为 `https://weboutsea-a-itools-web.vercel.app`。本地环境文件已准备项目 URL，公开密钥仍待读取。控制台在刷新后持续空白，浏览器标签页读取超时；尚未保存远端认证设置、邮件模板、SMTP 或 Vercel 环境变量，不能视作认证已启用。

公开密钥已于 2026-10-25 写入被 Git 忽略的本地 `.env.local`，未写入文档。真实 Auth settings 接口返回 HTTP 200，确认邮箱认证开启、注册允许、邮箱确认开启。Node 直连曾返回 ECONNRESET；沿用本机 HTTP 代理 127.0.0.1:7890 并启用 `--use-env-proxy` 后同一接口返回 200。本机启动服务时须让 Node 继承此代理配置（NO_PROXY 包含 localhost,127.0.0.1），云端不要复制本地代理地址。此结果不代表邮件投递、注册登录全流程或生产环境配置已完成。
