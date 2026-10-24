# Design

## Visual World

暗色系“运营控制台”风格，强调稳定执行、数据感与可持续迭代。视觉上采用深色背景、低饱和面板、清晰边界线与冷色高亮信号，突出“可落地、可发布、可持续运营”的品牌承诺。

## Surface Mode

Persuade（说服型落地页）：访客应快速理解能力、看到成果、并采取联系动作。

## Composition

1. 顶部导航：快速定位 Tools / Cases / Offers / Contact。
2. 首屏：一句价值主张 + 两个行为按钮 + 关键指标摘要。
3. 能力区：AI 工具栈卡片，包含阶段、价值、标签。
4. 成果区：案例结果与简短说明，建立可信度。
5. 方案区：可直接购买/合作的服务包结构。
6. 工作流区：让“持续产出内容”可视化。
7. 联系区：明确下一步动作，减少决策摩擦。

## Interaction & States

- 导航、按钮、标签具备 hover 反馈。
- 工具项通过 Live / Shipping / In Build 状态区分成熟度。
- 移动端转为单列，优先保持可读性与触达 CTA。

## Content System

站点文案与模块数据集中在 [`site-content.ts`](./ai-tools-site/src/data/site-content.ts)，后续新增 AI 工具、案例和服务可直接扩展数组，不必改页面结构。
