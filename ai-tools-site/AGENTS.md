# 项目长期开发要求

每次开发、修改或接入工具前，必须先阅读 [技术栈原理与开发指导](./技术栈原理与开发指导.md)，并遵循其中的长期要求。

其中，整个工具栈的所有 AI 生成等待流程（包括未来新增工具）都必须提供明确的动态等待反馈或进度指示器；有真实进度显示真实进度，无真实进度使用循环动画，避免用户误认为网页卡顿。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
