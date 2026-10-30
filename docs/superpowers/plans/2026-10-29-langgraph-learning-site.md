# LangGraph Learning Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve an English-default, Chinese-source LangGraph learning site at `/learn/langgraph/` inside the existing AI tools website.

**Architecture:** Vendor the selected upstream repository snapshot under `ai-tools-site/langgraph-lightning/upstream/`; keep VitePress-rendered English and Chinese pages under `ai-tools-site/langgraph-lightning/site/`. Build VitePress output into Next.js public assets before the existing Next.js build. Add a bilingual directory entry and route handling for static pages and assets.

**Tech Stack:** Next.js 16, React 19, VitePress 1.6, Vue 3, Markdown, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-29-langgraph-learning-site-design.md`

## Global Constraints

- `/learn/langgraph/`：英文首页，也是默认语言入口。
- `/learn/langgraph/zh/`：中文首页。
- 根据克隆仓库中可读取的 24 篇 Markdown 教程，覆盖 module-0 至 module-4；module-0/0.3 的上游文件是非 UTF-8 二进制内容，保留在来源快照但不渲染、不翻译。
- module-5 与 module-6 当前只有 Jupyter Notebook，没有 Markdown 教程；首版不把 Notebook 自动转换成新章节。
- 中文版直接呈现仓库中的中文 Markdown 与首页内容。
- 为未来广告位保留内容页布局空间；本次不接入广告网络、广告代码或发布者账户。
- 克隆 HEAD 固定为 `ffb7345b963dd48a57f313aa07f3b4d076d8dbb4`；保留作者、MIT 许可证、来源与译文说明。
- 不修改 AI 工具站已有的其他未提交内容。
- 不新增或运行自动化测试；执行 VitePress/Next.js 构建及人工页面检查。

## Review Focus

- 中文原文包含非 ASCII 文件名及标题锚点；验证 VitePress 生成路径、目录和链接能在浏览器直接打开。
- English translation must preserve Python code, API identifiers, commands, file paths and fenced-block boundaries; compare representative source/translation sections and review build output.
- Locale switch links must map matching chapter identity rather than relying on translated filenames; inspect language switching from several deep chapter pages.
- VitePress static output must be reachable through the existing Next.js/Vercel routes, including `/learn/langgraph/`, `/learn/langgraph/zh/`, chapter pages, search index and assets.
- Existing AI tool routes and uncommitted changes must remain intact; review the final diff by path and build the existing Next.js app.

---

### Task 1: Vendor the upstream snapshot and preserve provenance

**Files:**
- Create: `ai-tools-site/langgraph-lightning/upstream/` from the current clean clone at `source/langgraph-lightning`, excluding `.git` and generated/dependency directories.
- Create: `ai-tools-site/langgraph-lightning/site/SOURCE_NOTICE.md`.
- Preserve: `ai-tools-site/langgraph-lightning/upstream/LICENSE` and upstream README/source metadata.

**Interfaces:**
- Produces: an immutable local content snapshot tied to commit `ffb7345b963dd48a57f313aa07f3b4d076d8dbb4`.

- [x] Copy only tracked source files from the clean clone; keep the user's existing `ai-tools-site/public/learn-graph` deletion state untouched.
- [x] Add the source URL, commit hash/date, author attribution, MIT notice, and a clear note that English pages are translated derivatives.
- [x] Inspect `git status --short` to confirm the imported tree is limited to the new `ai-tools-site/langgraph-lightning/` directory.

### Task 2: Establish bilingual VitePress content and locale navigation

**Files:**
- Create: `ai-tools-site/langgraph-lightning/site/.vitepress/config.mts` based on the upstream VitePress configuration.
- Create: English `index.md` and English module pages under `ai-tools-site/langgraph-lightning/site/`.
- Create: Chinese `index.md` and original readable module-0 through module-4 Markdown pages under `ai-tools-site/langgraph-lightning/site/zh/`, excluding the corrupt module-0/0.3 source.
- Create: `ai-tools-site/langgraph-lightning/site/translation-map.json` for matching translated and original chapter URLs.

**Interfaces:**
- Produces: English default locale at `/learn/langgraph/`, Chinese locale at `/learn/langgraph/zh/`, and stable English/Chinese chapter mappings.

- [x] Configure VitePress locales, localized titles, nav, sidebars, search labels, footer, `lang`, source links, and a base path of `/learn/langgraph/`.
- [x] Keep Chinese tutorial text, code blocks, examples and order identical to the source snapshot; only provide the surrounding localized navigation and attribution.
- [x] Translate all 24 readable Markdown tutorials and the landing page into English, preserving code/API identifiers, commands, file paths and block boundaries.
- [x] Add chapter-level locale switching using the page map; use the locale home as fallback where an equivalent page does not exist.
- [x] Review representative pages in every module, focusing on preserved code and translated prose; confirm no source chapter is omitted.

### Task 3: Build VitePress into the existing Next.js app

**Files:**
- Modify: `ai-tools-site/package.json` and `ai-tools-site/package-lock.json`.
- Modify: `ai-tools-site/next.config.ts`.
- Modify: `ai-tools-site/langgraph-lightning/site/.vitepress/config.mts`.
- Generate during build: `ai-tools-site/public/learn/langgraph/`.

**Interfaces:**
- Produces: a build script that writes the static VitePress site under Next.js public assets before `next build`.

- [x] Add the VitePress/Vue build dependencies and a dedicated `docs:langgraph:build` script targeting `langgraph-lightning/site`.
- [x] Make the production build run the VitePress build before Next.js so Vercel's existing root project publishes both surfaces.
- [x] Configure VitePress output under `public/learn/langgraph/` without tracking generated artifacts as source.
- [x] Add precise rewrites for the English home, Chinese home, extensionless VitePress routes and static assets; preserve existing pet-photo rewrites.
- [x] Run `npm run docs:langgraph:build` and `npm run build`; inspect generated paths and verify no existing route is shadowed.

### Task 4: Add the bilingual learning-site entry and project documentation

**Files:**
- Modify: `ai-tools-site/src/data/site-content.ts`.
- Modify if needed: `ai-tools-site/src/components/tool-directory.tsx`.
- Modify: repository `README.md` and `ai-tools-site/README.md`.
- Modify: `ai-tools-site/langgraph-lightning/site/SOURCE_NOTICE.md`.

**Interfaces:**
- Produces: an English and Chinese tool-directory entry linking to `/learn/langgraph/` and `/learn/langgraph/zh/`, plus maintainer instructions for updating the snapshot and rebuilding.

- [x] Add a factual LangGraph learning entry with translated descriptions and counts for the 24 readable lessons; do not imply official LangChain authorship.
- [x] Point language-specific entry clicks to the matching language landing page.
- [x] Document how to update the fixed upstream snapshot, rebuild the docs and preserve attribution/license details.
- [x] Check diffs for the two README files and site-content data to preserve unrelated user changes.

### Task 5: Review the integrated site and deployment readiness

**Files:**
- Review: generated `ai-tools-site/public/learn/langgraph/` output.
- Review: `ai-tools-site/next.config.ts`, locale content, source notice and tool directory entry.

**Interfaces:**
- Produces: locally buildable English and Chinese pages ready for the existing Vercel project.

- [x] Run the VitePress and Next.js production builds.
- [ ] Start the app locally and use Chrome to inspect the English home, Chinese home, one deep chapter per module, local search, code blocks, language switching and mobile navigation. (Desktop routes and language interactions inspected; mobile viewport not verified.)
- [x] Confirm every chapter has a functioning source/translation link, the MIT license and author attribution are visible, and ad placeholders/scripts were not introduced.
- [x] Check the final Git diff to ensure only the design, plan, new LangGraph files and explicitly touched integration files changed. (Unrelated pre-existing user changes remain in the shared checkout.)
- [ ] If Vercel credentials/project access are available, publish through the existing project; otherwise leave the working tree ready and report the exact authentication or project-link step needed. (CLI is logged out and no `.vercel` project binding exists; no deploy attempted.)

## Execution Notes

- No commit or push is included; the repository has unrelated user changes in progress.
- Build and browser review should use the existing `ai-tools-site` root directory and current tool routes as regression boundaries.
